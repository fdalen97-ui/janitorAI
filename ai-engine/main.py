import os
import cv2
import time
import gc
import tempfile
import requests as _requests
from urllib.parse import urlparse as _urlparse
from google import genai
from models import DamageAnalysis
from google_api import connect_to_google_api_personal, upload_knowledge_base, share_doc_with_email
from doc_engine import replace_text_in_doc, upload_and_insert_image, insert_photo_gallery
from prompt import system_prompt, main_prompt, build_inspector_context, PROMPT_VERSION
from template_replacement import build_replacements
import re
from datetime import datetime, timezone
from report_idempotency import (
    validate_report_attempt_id as _pure_validate_report_attempt_id,
    reconcile_attempt as _pure_reconcile_attempt,
    abandon_attempt as _pure_abandon_attempt,
)

TEMP_PHOTO_DIR = "./temp_photos"


class ReportPipelineError(Exception):
    """
    Feil ETTER Gemini-analysen (fletting/galleri/deling): analysen er allerede
    fakturert, så unntaket bærer token_usage videre til API-et (COGS for
    feilede kjøringer), og doc_id for en halvferdig dokumentkopi som ikke lot
    seg rydde bort — den skal aldri bli liggende sporløst i Drive.
    """

    def __init__(self, message, token_usage=None, doc_id=None):
        super().__init__(message)
        self.token_usage = token_usage
        self.doc_id = doc_id


class ReportAlreadyComplete(Exception):
    """Raised when Drive already contains the finished document for an attempt."""

    def __init__(self, doc_id):
        super().__init__("A completed report already exists for this attempt")
        self.doc_id = doc_id


REPORT_ATTEMPT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
PROCESSING_RETRY_AFTER_SECONDS = 60 * 60


def _validate_report_attempt_id(value: str) -> str:
    return _pure_validate_report_attempt_id(value)


def _drive_query_quote(value: str) -> str:
    # The validator excludes quotes, but keep this defensive for future callers.
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _find_attempt_file(drive, attempt_id: str, allow_processing: bool = False,
                       return_state: bool = False):
    """Return an existing completed file, or remove an abandoned processing copy."""
    return _pure_reconcile_attempt(
        drive, attempt_id, allow_processing=allow_processing, return_state=return_state
    )


def _abandon_attempt(drive, doc_id: str | None, owned_doc_id: str | None) -> bool:
    return _pure_abandon_attempt(drive, doc_id, owned_doc_id)


def _validate_media_url(url: str) -> None:
    """
    Validates that a URL is a safe, expected media endpoint before fetching.
    Mirrors the same checks as _validate_video_url in server.py to prevent SSRF:
    - Scheme must be http or https
    - Path must match /api/media/<id>
    - Host must match API_BASE_URL when configured
    Raises ValueError with a descriptive message on any violation.
    """
    parsed = _urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}' — only http/https allowed")

    path_parts = parsed.path.strip("/").split("/")
    if len(path_parts) < 3 or path_parts[0] != "api" or path_parts[1] != "media":
        raise ValueError(
            f"URL path '{parsed.path}' does not match expected /api/media/<id> pattern"
        )

    api_base = os.getenv("API_BASE_URL", "").rstrip("/")
    if api_base:
        expected = _urlparse(api_base)
        if parsed.netloc != expected.netloc:
            raise ValueError(
                f"URL host '{parsed.netloc}' does not match configured API host '{expected.netloc}'"
            )


def _upload_inspector_photos(genai_client, project: dict) -> list:
    """
    Downloads each inspector photo (URL already contains auth token) and
    uploads it to the Gemini Files API so Gemini can actually see the images.

    Each URL is validated against the same allowlist used for the video URL
    (scheme, /api/media/<id> path, host pinning) to prevent SSRF.

    Skips individual photos that fail validation or download with a logged
    warning; other photos in the same request are still attempted.

    Returns a list of records {'file': gemini_file, 'path': local_tmp_path,
    'room': str, 'caption': str} in capture order. The local copies are KEPT
    (needed later for the report's evidence image and photo gallery) — the
    caller is responsible for calling cleanup_photo_files() when done.
    """
    records = []
    notes = project.get("notes") or []
    for note in notes:
        room = (note.get("room") or "").strip()
        for photo in (note.get("photos") or []):
            url = (photo.get("uri") or "").strip()
            if not url:
                continue

            # Validate before any network I/O
            try:
                _validate_media_url(url)
            except ValueError as ve:
                print(f"⛔ Rejected inspector photo URL (SSRF guard): {ve}")
                continue  # skip this photo; do not fetch

            tmp_path = None
            try:
                print(f"📸 Downloading inspector photo: {url.split('?')[0]} ...")
                resp = _requests.get(url, timeout=30)
                resp.raise_for_status()

                content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
                suffix = ".jpg" if "jpeg" in content_type else ".png" if "png" in content_type else ".jpg"

                os.makedirs(TEMP_PHOTO_DIR, exist_ok=True)
                fd, tmp_path = tempfile.mkstemp(dir=TEMP_PHOTO_DIR, suffix=suffix)
                with os.fdopen(fd, "wb") as f:
                    f.write(resp.content)
                photo_file = genai_client.files.upload(file=tmp_path)
                # Denial-of-Wallet-vern: bind ventingen (som videostien),
                # ellers kan et foto som henger i PROCESSING låse jobben.
                photo_deadline = time.monotonic() + 120  # maks 2 min
                while photo_file.state.name == "PROCESSING":
                    if time.monotonic() > photo_deadline:
                        raise TimeoutError(" foto-prosessering tok for lang tid (>2 min)")
                    time.sleep(1)
                    photo_file = genai_client.files.get(name=photo_file.name)
                if photo_file.state.name == "FAILED":
                    raise RuntimeError("Gemini klarte ikke å prosessere inspektørfotoet")
                records.append({
                    "file": photo_file,
                    "path": tmp_path,
                    "room": room,
                    "caption": (photo.get("caption") or "").strip(),
                })
                print(f"✅ Inspector photo uploaded to Gemini: {photo_file.name}")
            except Exception as exc:
                print(f"⚠️  Skipping inspector photo (fetch/upload failed): {exc}")
                if tmp_path:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
    return records


def cleanup_photo_files(photo_records: list) -> None:
    """Deletes the local temp copies kept by _upload_inspector_photos."""
    for rec in photo_records:
        try:
            os.unlink(rec["path"])
        except OSError:
            pass


def _photo_manifest(photo_records: list) -> str:
    """
    Numbered photo list for the prompt. The numbering (1-based, upload order)
    is the ONLY numbering source_photo_index may reference — kildekobling:
    hvert bevispunkt skal peke på fotoet som faktisk viser det.
    """
    if not photo_records:
        return ""
    lines = ["### VEDLAGTE FOTO (nummerert — bruk disse numrene i source_photo_index)"]
    for i, rec in enumerate(photo_records, 1):
        parts = [f"Foto {i}"]
        if rec["room"]:
            parts.append(f"(rom: {rec['room']})")
        if rec["caption"]:
            parts.append(f"— {rec['caption']}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


GEMINI_MODEL = "gemini-3.8-flash"


def prepare_gemini_media(genai_client, video_path: str | None, project: dict | None):
    """
    Laster opp video og befaringsfoto til Gemini og returnerer
    (video_file, photo_records). Kaller aldri Docs/Drive, så både
    create_report() og den dokumentfrie Labs-veien kan bruke den.

    Ved unntak er det kallerens ansvar å rydde: photo_records kan være delvis
    fylt, og de lokale kopiene må gjennom cleanup_photo_files().
    """
    video_file = None
    photo_records = []

    # 2. Gemini Analysis (multimodal). Video is useful evidence when present,
    # but reports must also work from notes, transcriptions, photos, and metadata.
    if video_path:
        print("🤖 Gemini is analyzing available video evidence...")
        video_file = genai_client.files.upload(file=video_path)
        # Denial-of-Wallet-vern: bind ventingen på videoprosessering (ellers kan en
        # fil som henger i PROCESSING holde en fakturerbar jobb åpen i det uendelige).
        video_deadline = time.monotonic() + 300  # maks 5 min
        while video_file.state.name == "PROCESSING":
            if time.monotonic() > video_deadline:
                raise TimeoutError("Gemini video-prosessering tok for lang tid (>5 min)")
            time.sleep(2)
            video_file = genai_client.files.get(name=video_file.name)
        if video_file.state.name == "FAILED":
            raise RuntimeError("Gemini klarte ikke å prosessere videoen")

    # Upload inspector photos (if any) so Gemini can analyse them with every
    # other available inspection source. Local copies are cleaned up by the caller.
    if project:
        photo_records = _upload_inspector_photos(genai_client, project)
        if photo_records:
            print(f"📸 {len(photo_records)} inspector photo(s) ready for Gemini")

    return video_file, photo_records


def analyze_damage(
    genai_client,
    project: dict | None,
    report_meta: dict | None,
    video_file=None,
    photo_records: list | None = None,
    enabled=None,
):
    """
    Selve analysen: kunnskapsbase → kontekst → Gemini → sitatport. Rører
    verken Docs eller Drive-kopiering, slik at den kan kjøres dokumentfritt fra
    Labs (/api/analyze) med et vilkårlig sett promptblokker — og fra
    create_report() med produksjonsstandarden, der `enabled=None`.

    `enabled` er blokk-id-er fra prompt.BLOCKS. Returnerer
    (analysis, token_usage, prompt_meta), der prompt_meta beskriver nøyaktig
    den prompten som faktisk ble sendt (sha256 over system + oppdrag + kontekst).
    """
    photo_records = photo_records or []
    active = resolve_enabled(enabled)
    photo_files = [rec["file"] for rec in photo_records]

    # Kunnskapsbasen er en egen blokk: den krever Drive-lesetilgang og er den
    # eneste delen av analysen som gjør det. Av = raskere/billigere, men ikke
    # lenger sammenlignbart med produksjon.
    knowledge_files = []
    if "kunnskapsbase_pdf" in active:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        knowledge_path = os.path.join(current_dir, "temp_knowledge")

        if not os.path.exists(knowledge_path):
            knowledge_path = os.path.join(current_dir, "knowlegde")

        print(f"📚 Opplasting av kunnskapsbase fra: {knowledge_path}")
        knowledge_files = upload_knowledge_base(genai_client, knowledge_path)

    # Build contents from every available source. No evidence type has an
    # automatic priority; Gemini reconciles the supplied material.
    # report_meta (building year, inspection date) feeds the deterministic
    # case-signal block computed in build_case_signals() — see
    # docs/ARCHITECTURE_WATER_DAMAGE_TREE.md §3.6/steg 0.
    # resolve_prompt() komponerer én gang, så sha256-en i prompt_meta beskriver
    # nøyaktig den teksten som sendes — ikke en rekonstruksjon.
    resolved = resolve_prompt(active, project or {}, report_meta or {})
    context_parts = [resolved["context"]] if resolved["context"] else []
    if "foto_manifest" in active:
        manifest = _photo_manifest(photo_records)
        if manifest:
            context_parts.append(manifest)

        contents = (
            ([video_file] if video_file else [])
            + photo_files
            + knowledge_files
            + context_parts
            + [main_prompt()]
        )

        print("🧠 Sending content to Gemini for analysis...")
        gemini_response = genai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config={"response_mime_type": "application/json",
                    "response_schema": DamageAnalysis,
                    "system_instruction": system_prompt(),
                    "temperature": 0.0,    # Setter kreativiteten til null
                    "top_p": 0.1,         # Velger kun de mest sannsynlige ordene
                    "top_k": 1,           # Velger kun det aller beste ordet for hvert steg
                    "seed": 42,
                    # Denial-of-Wallet-vern: hard timeout (ms) på selve analysekallet —
                    # den største og tidligere ubundne kostnadsdriveren.
                    "http_options": {"timeout": 120000}}
        )
        analysis = gemini_response.parsed

        # Sitatport: «Byggforsk-henvisninger vises kun med verifisert punktnummer».
        # Alt modellen siterer valideres mot metadata-indeksen; uverifiserte
        # referanser forkastes fremfor å nå rapporten (anti-hallusinering).
        # Telling (kvalitetsmåling, docs/taleteknologi-laerdommer.md): hvor ofte
        # porten forkaster avgjør om «Byggforsk-henvisninger» i salgsflaten er
        # en påstand med dekning. Tallet følger svaret og bokføres per kjøring
        # sammen med prompt_version i report_generations.
        from byggforsk_index import har_nummer, valider_referanse
        # proposed = referanser med et NNN.NNN-nummer; «Ingen»/«N/A»/«-» er
        # ikke forslag og telles som unparseable, ellers blåses forkastnings-
        # raten opp av tomprat (og det er nettopp raten docs leser).
        citation_stats = {"proposed": 0, "verified": 0, "rejected": 0, "unparseable": 0}
        if analysis and analysis.evidence_points:
            for punkt in analysis.evidence_points:
                original = punkt.technical_reference
                verifisert = valider_referanse(original)
                if original and not har_nummer(original):
                    citation_stats["unparseable"] += 1
                elif original:
                    citation_stats["proposed"] += 1
                    if verifisert:
                        citation_stats["verified"] += 1
                    else:
                        citation_stats["rejected"] += 1
                        print(f"⚠️  Forkastet uverifisert Byggforsk-referanse: {original!r}")
                punkt.technical_reference = verifisert
        print(
            f"📚 Sitatport ({PROMPT_VERSION}): {citation_stats['verified']} verifisert, "
            f"{citation_stats['rejected']} forkastet av {citation_stats['proposed']} foreslått, "
            f"{citation_stats['unparseable']} uten nummer"
        )
    except Exception:
        _cleanup_photo_files(photo_records)
        raise

    # COGS: fang tokenforbruk fra rå-responsen før den forkastes, så backend kan
    # måle faktisk kostnad per rapport (docs/prising-bruksbasert.md).
    token_usage = None
    usage = getattr(gemini_response, "usage_metadata", None)
    if usage is not None:
        token_usage = {
            "model": GEMINI_MODEL,
            "input_tokens": getattr(usage, "prompt_token_count", None),
            "output_tokens": getattr(usage, "candidates_token_count", None),
            "total_tokens": getattr(usage, "total_token_count", None),
        }

    prompt_meta = {
        "prompt_version": resolved["prompt_version"],
        "blocks_enabled": resolved["blocks_enabled"],
        "sha256": resolved["sha256"],
        "model": GEMINI_MODEL,
        "system": resolved["system"],
        "mission": resolved["mission"],
        "context": resolved["context"],
    }

    del contents, knowledge_files, photo_files
    return analysis, token_usage, prompt_meta


def create_report(video_path: str | None, master_id, output_folder, gemini_key, report_meta: dict | None = None, project: dict | None = None, tester_email: str | None = None, report_attempt_id: str | None = None):
    # 1. Init Connections
    docs, drive = connect_to_google_api_personal()
    if report_attempt_id is not None:
        report_attempt_id = _validate_report_attempt_id(report_attempt_id)
        existing_doc_id = _find_attempt_file(drive, report_attempt_id)
        if existing_doc_id:
            raise ReportAlreadyComplete(existing_doc_id)
    doc_id = None
    if report_attempt_id:
        copy_name = f"Rapport_Skade_{int(time.time())}"
        new_doc = drive.files().copy(
            fileId=master_id,
            supportsAllDrives=True,
            body={
                "name": copy_name,
                "parents": [output_folder],
                "appProperties": {
                    "report_attempt_id": report_attempt_id,
                    "report_state": "processing",
                    "processing_started_at": datetime.now(timezone.utc).isoformat(),
                },
            },
        ).execute()
        doc_id = new_doc["id"]
        # Close the list-then-copy race. The oldest attempt file is canonical;
        # a concurrent request must not proceed to Gemini with a second copy.
        try:
            canonical = _find_attempt_file(
                drive, report_attempt_id, allow_processing=True, return_state=True
            )
        except Exception:
            _abandon_attempt(drive, doc_id, doc_id)
            raise
        if canonical and canonical["id"] != doc_id:
            try:
                _abandon_attempt(drive, doc_id, doc_id)
            except Exception:
                pass
            if canonical["state"] == "complete":
                raise ReportAlreadyComplete(canonical["id"])
            raise RuntimeError("Report attempt is already processing")
    video_file = None
    photo_records = []
    try:
        genai_client = genai.Client(api_key=gemini_key)
        video_file, photo_records = prepare_gemini_media(genai_client, video_path, project)
    except Exception:
        cleanup_photo_files(photo_records)
        if doc_id:
            _abandon_attempt(drive, doc_id, doc_id)
        raise

    # Feiler noe i analysefasen (kunnskapsopplasting, Gemini-kallet,
    # valideringen), skal de lokale fotokopiene ikke bli liggende igjen i
    # temp-katalogen — unntaket propagerer ellers uendret som før.
    try:
        analysis, token_usage, _prompt_meta = analyze_damage(
            genai_client,
            project,
            report_meta,
            video_file=video_file,
            photo_records=photo_records,
        )
    except Exception:
        cleanup_photo_files(photo_records)
        if doc_id:
            _abandon_attempt(drive, doc_id, doc_id)
        raise

    try:
        # Free memory after analysis — the contents list can be large.
        # photo_records beholdes: de lokale kopiene brukes til bevisbilde/galleri.
        del video_file
        gc.collect()
        print("🧹 Cleared analysis objects from memory")
    except Exception:
        cleanup_photo_files(photo_records)
        if doc_id:
            _abandon_attempt(drive, doc_id, doc_id)
        raise

    # Vakt (pilotfunn): gemini_response.parsed er None når svaret ikke lot seg
    # tolke mot DamageAnalysis-skjemaet. Uten vakten krasjet flettingen lenger
    # ned på analysis.area med en uforståelig AttributeError — ETTER at
    # dokumentkopien var laget og analysen fakturert. Stopp her: ingen kopi
    # lages, og token_usage følger med så kostnaden bokføres som report_failed.
    # Meldingen er statisk med hensikt: leverandørens unntakstekst skal aldri
    # nå klienten.
    if analysis is None:
        _cleanup_photo_files(photo_records)
        raise ReportPipelineError(
            "Analysen kom tom tilbake fra modellen (svaret matchet ikke rapportskjemaet). Prøv igjen.",
            token_usage=token_usage,
        )

    # 3–6 kjører i én try: feiler noe ETTER at dokumentkopien er laget, skal
    # (a) den halvferdige kopien slettes fra Drive (ellers ligger den igjen og
    # kan forveksles med en ekte rapport), og (b) token_usage følge unntaket
    # videre — analysen er fakturert selv om rapporten aldri ble ferdig.
    try:
        # 3. Create Doc Copy
        if doc_id is None:
            copy_name = f"Rapport_Skade_{int(time.time())}"
            new_doc = drive.files().copy(
                fileId=master_id,
                supportsAllDrives=True,
                body={'name': copy_name, 'parents': [output_folder]},
            ).execute()
            doc_id = new_doc['id']

        # 4. Process Evidence Image (memory-optimized with aggressive cleanup)
        evidence_points = (analysis.evidence_points if analysis and analysis.evidence_points else [])
        if video_path and len(evidence_points) > 0:
            # Pick the timestamp Gemini identified as the best evidence
            best_point = analysis.evidence_points[0]
            print(f"📸 Extracting frame at {best_point.timestamp_ms}ms: {best_point.caption}")

            cap = None
            frame = None
            evidence_path = None
            try:
                cap = cv2.VideoCapture(video_path)
                cap.set(cv2.CAP_PROP_POS_MSEC, best_point.timestamp_ms)
                ret, frame = cap.read()

                if ret and frame is not None:
                    # Per-kjøring-unik fil, ALDRI en fast delt sti: motoren
                    # kjører nå flertrådet, og med en delt «evidence.jpg» kunne
                    # to samtidige kjøringer overskrive hverandres bevisbilde —
                    # feil skades bilde i feil rapport, på tvers av testere.
                    # (.jpg-suffiks kreves så OpenCV velger JPEG-enkoderen;
                    # fd-en lukkes fordi imwrite åpner via sti.)
                    os.makedirs(TEMP_PHOTO_DIR, exist_ok=True)
                    fd, evidence_path = tempfile.mkstemp(dir=TEMP_PHOTO_DIR, suffix=".jpg")
                    os.close(fd)
                    cv2.imwrite(evidence_path, frame)
                    print(f"💾 Frame saved to {evidence_path}")

                    # Free frame memory immediately
                    del frame
                    frame = None

                    upload_and_insert_image(drive, docs, doc_id, evidence_path, "{{damage.cause.picture}}", output_folder)
                else:
                    print("⚠️ Failed to extract frame from video")
            finally:
                # Ensure video capture is always released
                if cap is not None:
                    cap.release()
                    del cap

                # Delete frame if it still exists
                if frame is not None:
                    del frame

                if evidence_path is not None:
                    try:
                        os.unlink(evidence_path)
                    except OSError:
                        pass

                # Force garbage collection to free OpenCV buffers
                gc.collect()
                print("🧹 Released video capture and frame buffers")
        elif photo_records and len(evidence_points) > 0:
            # Pilotfunn: uten video sto {{damage.cause.picture}} igjen som rå
            # plassholder i rapporten. Bruk fotoet modellen selv pekte ut som
            # beste bevis (source_photo_index fra manifestet); fall tilbake til
            # første foto når indeksen mangler eller er ugyldig.
            chosen = photo_records[0]
            idx = getattr(evidence_points[0], "source_photo_index", None)
            if isinstance(idx, int) and 1 <= idx <= len(photo_records):
                chosen = photo_records[idx - 1]
            print(f"📸 Ingen video — bruker inspektørfoto som bevisbilde: {chosen['path']}")
            try:
                upload_and_insert_image(drive, docs, doc_id, chosen["path"], "{{damage.cause.picture}}", output_folder)
            except Exception as exc:
                print(f"⚠️  Kunne ikke sette inn bevisbilde fra foto: {exc}")
        else:
            print("ℹ️ Ingen video- eller fotobevis å bruke som bevisbilde.")

        # 5. Final Text Replacement (Gemini + project metadata)
        replacements = build_replacements(report_meta or {})

        # Sikkerhetsnett: hvis bildeinnsettingen over lyktes, er plassholderen
        # allerede borte og denne erstatningen er en no-op. Hvis den feilet eller
        # ingen bevis fantes, skal LESEREN aldri se en rå mal-plassholder.
        replacements["{{damage.cause.picture}}"] = (
            "Se «Bilder av stedet»." if photo_records else "—"
        )

        replacements.update({
            "{{damage.cause.area}}": analysis.area,
            "{{damage.cause.source}}": analysis.source,
            # New structured classifications. Keep both the canonical
            # damage.cause.* names and short aliases so older master templates
            # can adopt the fields without changing the API response shape.
            "{{damage.cause.source_category}}": getattr(analysis.source_category, "value", analysis.source_category),
            "{{damage.cause.acute_or_gradual}}": getattr(analysis.acute_or_gradual, "value", analysis.acute_or_gradual),
            "{{damage.source_category}}": getattr(analysis.source_category, "value", analysis.source_category),
            "{{damage.acute_or_gradual}}": getattr(analysis.acute_or_gradual, "value", analysis.acute_or_gradual),
            "{{damage.cause.cause}}": analysis.cause,
            "{{damage.cause.description}}": analysis.description,
            # Checkbox logic
            "{{habitable.is_habitable}}": f"Beboelighet: {'☒ Ja' if analysis.is_habitable else '☐ Ja'} {'☒ Nei' if not analysis.is_habitable else '☐ Nei'}",
            "{{damage.extent.description}}": analysis.extent_description,
            "{{damage.repairs_needed.description}}": analysis.repairs_description
        })
        replace_text_in_doc(docs, doc_id, replacements)

        # 5b. Bildegalleri: ALLE inspektørfoto inn under «Bilder av stedet», i
        # opptaksrekkefølge med rom/bildetekst. Pilotfunn: seksjonen sto tom og
        # testeren kunne ikke se hvilke bilder som faktisk var med i grunnlaget.
        if photo_records:
            gallery = []
            for i, rec in enumerate(photo_records, 1):
                label_parts = [f"Foto {i}"]
                if rec["room"]:
                    label_parts.append(f"— {rec['room']}")
                if rec["caption"]:
                    label_parts.append(f": {rec['caption']}")
                gallery.append({"path": rec["path"], "label": " ".join(label_parts)})
            try:
                insert_photo_gallery(drive, docs, doc_id, gallery, "Bilder av stedet", output_folder)
                print(f"🖼️  Satte inn {len(gallery)} foto under «Bilder av stedet»")
            except Exception as exc:
                print(f"⚠️  Kunne ikke sette inn bildegalleri: {exc}")

        cleanup_photo_files(photo_records)

        # 6. Share the document with the tester's email (if provided)
        if tester_email and tester_email.strip():
            try:
                share_doc_with_email(drive, doc_id, tester_email.strip(), role='reader')
            except Exception as e:
                # Non-fatal: log and continue — report was still generated successfully
                print(f"⚠️  Could not share doc with {tester_email}: {e}")
        if report_attempt_id:
            drive.files().update(
                fileId=doc_id,
                supportsAllDrives=True,
                body={"appProperties": {
                    "report_attempt_id": report_attempt_id,
                    "report_state": "complete",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }},
                fields="id,appProperties",
            ).execute()
    except Exception as exc:
        cleanup_photo_files(photo_records)
        orphaned_doc_id = None
        if doc_id:
            try:
                _abandon_attempt(drive, doc_id, doc_id)
                print(f"🧹 Slettet halvferdig dokumentkopi {doc_id} etter pipelinefeil")
            except Exception as del_exc:
                orphaned_doc_id = doc_id
                print(f"⚠️  Fikk ikke slettet halvferdig dokumentkopi {doc_id}: {del_exc}")
        raise ReportPipelineError(str(exc), token_usage=token_usage, doc_id=orphaned_doc_id) from exc

    print(f"✅ Pipeline Complete: https://docs.google.com/document/d/{doc_id}")
    # A5 (versjonslagring): den strukturerte analysen returneres sammen med
    # dokument-ID-en slik at API/app kan lagre AI-utkastet som egen versjon —
    # ikke bare det ferdig flettede dokumentet. token_usage gir COGS-måling.
    return doc_id, analysis, token_usage, citation_stats
