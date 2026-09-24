import os
import socket
import tempfile
import requests
from urllib.parse import urlparse
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from google import genai
from main import (
    analyze_damage,
    create_report,
    prepare_gemini_media,
    ReportPipelineError,
    ReportAlreadyComplete,
    cleanup_photo_files,
)
from prompt import PROMPT_VERSION, blocks_manifest, resolve_enabled
from google_api import connect_to_google_api_personal, download_knowledge_from_drive, export_doc_as_pdf, export_doc_as_docx

# Google Docs/Drive-klientene (httplib2) har ellers ingen timeout: én hengende
# forbindelse kunne okkupere motoren lenge etter at brukeren fikk feilmelding.
socket.setdefaulttimeout(120)

app = FastAPI()


@app.get("/health")
def health():
    # Liveness for oppetidsmonitor: prosessen kjører og kan svare. Bevisst uten
    # Google-API-sjekk her — den ville hamret OAuth-endepunktet ved hyppig
    # polling; token-feil oppdages som 503 fra /api/report og i loggene.
    return {"status": "ok", "prompt_version": PROMPT_VERSION}

class ReportRequest(BaseModel):
    video_url: Optional[str] = None  # Optional uploaded inspection video
    report_meta: dict = {}    # Per-project metadata for template replacements
    project: dict = {}        # Full project context: description, notes (text/transcription/photos)
    tester_email: str = ""    # Email address to share the finished doc with (optional)
    report_attempt_id: Optional[str] = None


class AnalyzeRequest(BaseModel):
    """
    Dokumentfri testkjøring (Labs). Samme materiale som /api/report, men uten
    Google Doc: ingen malkopi, ingen fletting, ingen deling.
    """
    video_url: Optional[str] = None
    report_meta: dict = {}
    project: dict = {}
    # None = produksjonsstandard. Ellers blokk-id-ene fra /api/prompt/blocks.
    blocks: Optional[list] = None
    # Tar med den løste promptteksten i svaret (default på: den er poenget
    # med å feilsøke en variant).
    include_prompt: bool = True

TEMP_KNOWLEDGE_DIR = "./temp_knowledge"
TEMP_VIDEO_DIR = "./videos"


def _validate_video_url(video_url: str) -> None:
    """
    Reject URLs that don't point to the expected media storage endpoint.
    Prevents SSRF: only allow HTTPS (or HTTP in local dev) URLs whose path
    matches /api/media/<id> and whose host matches API_BASE_URL when set.
    """
    parsed = urlparse(video_url)

    # Must be http or https
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}' — only http/https allowed")

    # Path must match /api/media/<something>
    path_parts = parsed.path.strip("/").split("/")
    if len(path_parts) < 3 or path_parts[0] != "api" or path_parts[1] != "media":
        raise ValueError(
            f"URL path '{parsed.path}' does not match expected /api/media/<id> pattern"
        )

    # If API_BASE_URL is set, enforce the host matches
    api_base = os.getenv("API_BASE_URL", "").rstrip("/")
    if api_base:
        expected = urlparse(api_base)
        if parsed.netloc != expected.netloc:
            raise ValueError(
                f"URL host '{parsed.netloc}' does not match configured API host '{expected.netloc}'"
            )


def download_video_from_url(video_url: str, local_dir: str) -> str:
    """
    Downloads a video from the app's media storage endpoint to a local temp
    directory.  Uses an atomic write (temp file + rename) so concurrent calls
    for the same media ID never read a half-written file.

    The file is saved with an extension derived from the Content-Type header so
    Gemini can detect the mime type without needing an explicit hint.

    Returns the local file path.
    """
    import mimetypes as _mimetypes

    _validate_video_url(video_url)

    if not os.path.exists(local_dir):
        os.makedirs(local_dir)

    # Stable cache key: last path segment of the URL (media UUID), no query string
    url_path = video_url.split("?")[0]
    media_id = url_path.rstrip("/").split("/")[-1]

    # Check if a cached copy already exists (with any extension)
    for existing in os.listdir(local_dir):
        if existing == media_id or existing.startswith(media_id + "."):
            cached = os.path.join(local_dir, existing)
            print(f"✅ Video already cached locally: {cached}")
            return cached

    print(f"📥 Downloading video from media storage: {url_path} ...")
    response = requests.get(video_url, stream=True, timeout=120)
    if response.status_code == 404:
        raise FileNotFoundError(f"Media not found on server (404): {url_path}")
    if response.status_code == 401:
        raise PermissionError("Unauthorized when fetching video from media storage (401)")
    response.raise_for_status()

    # Derive file extension from Content-Type so Gemini can detect mime type
    content_type = response.headers.get("Content-Type", "video/mp4").split(";")[0].strip()
    ext = _mimetypes.guess_extension(content_type) or ".mp4"
    # guess_extension can return ".mp4v" for video/mp4 — normalise. ".bin"
    # (application/octet-stream fra en eldre server) ville fått Gemini til å
    # avvise opplastingen — anta mp4, Gemini sniffer containeren selv.
    if ext in (".mp4v", ".mpg4", ".bin"):
        ext = ".mp4"
    local_path = os.path.join(local_dir, media_id + ext)

    # Write to a temp file in the same directory, then atomically rename so a
    # concurrent reader never sees a partial file.
    fd, tmp_path = tempfile.mkstemp(dir=local_dir)
    try:
        with os.fdopen(fd, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        os.replace(tmp_path, local_path)   # atomic on POSIX; overwrites on Windows
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise

    print(f"✅ Video saved to: {local_path}")
    return local_path


# Merk: begge endepunktene er vanlige `def`, ikke `async def` — FastAPI kjører
# dem da i threadpool. Med `async def` blokkerte det synkrone tungarbeidet
# (Gemini, Docs-fletting, Drive-eksport) hele event-loopen, så én rapport
# under generering stengte hele tjenesten for alle andre (head-of-line
# blocking): tester nr. 2 fikk timeout selv om motoren var frisk.
@app.get("/api/export/{doc_id}")
def export_document(doc_id: str, format: str, fastapi_req: Request):
    """
    Exports a Google Doc as PDF or DOCX and streams the bytes back.
    Called by the Node.js API when a tester requests a file download.

    Query params:
      format — 'pdf' or 'docx'
    """
    client_token = fastapi_req.headers.get("x-tester-token")
    server_token = os.getenv("TESTER_TOKEN")
    if client_token != server_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if format not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="format must be 'pdf' or 'docx'")

    try:
        _, drive_service = connect_to_google_api_personal()
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Google API: {str(e)}")

    try:
        if format == "pdf":
            content = export_doc_as_pdf(drive_service, doc_id)
            mime_type = "application/pdf"
            filename = "report.pdf"
        else:
            content = export_doc_as_docx(drive_service, doc_id)
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = "report.docx"
    except Exception as e:
        print(f"❌ Export failed for doc {doc_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    return Response(
        content=bytes(content) if not isinstance(content, bytes) else content,
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/prompt/blocks")
def prompt_blocks(fastapi_req: Request):
    """
    Blokkregisteret — kilden admin-dashbordet genererer avkryssingsboksene fra,
    slik at UI-et ikke kan drifte fra prompt.BLOCKS.
    """
    client_token = fastapi_req.headers.get("x-tester-token")
    if client_token != os.getenv("TESTER_TOKEN"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"prompt_version": PROMPT_VERSION, "blocks": blocks_manifest()}


@app.post("/api/analyze")
def run_doc_free_analysis(fastapi_req: Request, request: AnalyzeRequest):
    """
    Testkjøring uten Google Doc: kjører samme analyse som /api/report og
    returnerer den strukturerte DamageAnalysis direkte. Ingen malkopi, ingen
    fletting, ingen deling — og ingen Google-kontakt i det hele tatt med mindre
    kunnskapsbase-blokken er på.
    """
    client_token = fastapi_req.headers.get("x-tester-token")
    if client_token != os.getenv("TESTER_TOKEN"):
        print("🚫 Rejected /api/analyze: wrong token")
        raise HTTPException(status_code=401, detail="Unauthorized")

    request_id = fastapi_req.headers.get("x-request-id")
    if request_id:
        print(f"🔗 Request-id fra API: {request_id}")

    active = resolve_enabled(request.blocks)

    # Drive trengs KUN for kunnskapsbasen. Er blokken av, rører denne veien
    # ingen Google-tjeneste — det er hele poenget med den dokumentfrie stien.
    if "kunnskapsbase_pdf" in active:
        knowledge_id = os.getenv("KNOWLEDGE_FOLDER")
        if knowledge_id:
            try:
                _docs, drive_service = connect_to_google_api_personal()
            except EnvironmentError as e:
                raise HTTPException(status_code=503, detail=str(e))
            except Exception as e:
                raise HTTPException(status_code=503, detail=f"Failed to connect to Google API: {str(e)}")
            download_knowledge_from_drive(drive_service, knowledge_id, TEMP_KNOWLEDGE_DIR)

    video_path = None
    if request.video_url:
        try:
            video_path = download_video_from_url(request.video_url, TEMP_VIDEO_DIR)
        except (ValueError, FileNotFoundError, PermissionError) as e:
            return {"status": "error", "message": str(e), "prompt_version": PROMPT_VERSION}
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to download video: {str(e)}",
                "prompt_version": PROMPT_VERSION,
            }

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured")

    photo_records = []
    try:
        genai_client = genai.Client(api_key=gemini_key)
        video_file, photo_records = prepare_gemini_media(
            genai_client, video_path, request.project
        )
        analysis, token_usage, prompt_meta = analyze_damage(
            genai_client,
            request.project,
            request.report_meta,
            video_file=video_file,
            photo_records=photo_records,
            enabled=active,
        )
    except Exception as e:
        print(f"❌ Error during doc-free analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e), "prompt_version": PROMPT_VERSION}
    finally:
        # Ingen Doc å rydde her — kun de lokale fotokopiene.
        cleanup_photo_files(photo_records)

    payload = {
        "status": "success",
        "analysis": analysis.model_dump() if analysis is not None else None,
        "token_usage": token_usage,
        "prompt_version": prompt_meta["prompt_version"],
        "prompt_sha256": prompt_meta["sha256"],
        "blocks_enabled": prompt_meta["blocks_enabled"],
        "model": prompt_meta["model"],
    }
    if request.include_prompt:
        payload["resolved_prompt"] = {
            "system": prompt_meta["system"],
            "mission": prompt_meta["mission"],
            "context": prompt_meta["context"],
        }
    return payload


@app.post("/api/report")
def run_analysis(fastapi_req: Request, request: ReportRequest):
    client_token = fastapi_req.headers.get("x-tester-token")
    server_token = os.getenv("TESTER_TOKEN")

    if client_token != server_token:
        print(f"🚫 Rejected request: wrong token")
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Korrelasjon med API-loggen: backend sender sin request-id videre hit.
    request_id = fastapi_req.headers.get("x-request-id")
    if request_id:
        print(f"🔗 Request-id fra API: {request_id}")

    try:
        docs_service, drive_service = connect_to_google_api_personal()
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Google API: {str(e)}")

    # 1. Download reference knowledge base (PDFs) from Google Drive
    knowledge_id = os.getenv("KNOWLEDGE_FOLDER")
    if knowledge_id:
        download_knowledge_from_drive(drive_service, knowledge_id, TEMP_KNOWLEDGE_DIR)

    # 2. Download the inspection video only when one is available. Notes,
    # transcriptions, photos, and report metadata are valid report evidence too.
    video_path = None
    if request.video_url:
        try:
            video_path = download_video_from_url(request.video_url, TEMP_VIDEO_DIR)
        except (ValueError, FileNotFoundError, PermissionError) as e:
            return {"status": "error", "message": str(e)}
        except Exception as e:
            return {"status": "error", "message": f"Failed to download video: {str(e)}"}

    # 3. Run the analysis pipeline
    try:
        doc_id, analysis, token_usage, citation_stats = create_report(
            video_path=video_path,
            master_id=os.getenv("MASTER_ID"),
            output_folder=os.getenv("OUTPUT_FOLDER") or os.getenv("FOLDER_ID"),
            gemini_key=os.getenv("GEMINI_API_KEY"),
            report_meta=request.report_meta,
            project=request.project,
            tester_email=request.tester_email or None,
            report_attempt_id=request.report_attempt_id,
        )
        report_url = f"https://docs.google.com/document/d/{doc_id}"
        # A5: den strukturerte analysen følger med som eget felt, slik at
        # appen kan lagre AI-utkastet som uendret versjon og la takstpersonen
        # redigere en egen godkjent versjon med felt-diff. token_usage gir
        # backend COGS-måling per rapport (docs/prising-bruksbasert.md).
        return {
            "status": "success",
            "url": report_url,
            "analysis": analysis.model_dump() if analysis is not None else None,
            "token_usage": token_usage,
            "prompt_version": PROMPT_VERSION,
            # Sitatportens telling per kjøring — bokføres av API-et i
            # report_generations (kvalitetsmåling uten dashbord).
            "citation_stats": citation_stats,
        }
    except ReportPipelineError as e:
        # Feil ETTER analysen: Gemini er fakturert (token_usage følger med så
        # API-et kan bokføre kostnaden), og doc_id peker på en halvferdig kopi
        # som IKKE lot seg slette — den må ryddes manuelt i Drive.
        print(f"❌ Pipeline error after analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        payload = {"status": "error", "message": str(e), "prompt_version": PROMPT_VERSION}
        if e.token_usage:
            payload["token_usage"] = e.token_usage
        if e.doc_id:
            payload["doc_id"] = e.doc_id
        return payload
    except ReportAlreadyComplete as e:
        # A retried API request must discover the original document rather than
        # charging Gemini or creating a second Drive copy.
        return {
            "status": "success",
            "url": f"https://docs.google.com/document/d/{e.doc_id}",
            "analysis": None,
            "token_usage": None,
            "idempotent": True,
            "prompt_version": PROMPT_VERSION,
        }
    except Exception as e:
        print(f"❌ Error during analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e), "prompt_version": PROMPT_VERSION}
