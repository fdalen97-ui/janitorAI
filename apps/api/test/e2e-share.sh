#!/usr/bin/env bash
# End-to-end test of the share-link chain against a real local Postgres.
# Usage: bash test/e2e-share.sh   (from apps/api)
# Requires: postgres 16 binaries, curl, jq. Exits non-zero on first failure.
set -u

API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PGPORT=55432
APIPORT=8090
TOKEN="e2e-token"
BASE="http://127.0.0.1:${APIPORT}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | head -1)"
FAILURES=0

cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null
  asPg "$PGBIN/pg_ctl" -D "$WORK/pg" stop -m immediate >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then
    echo "ok   $1"
  else
    echo "FAIL $1 — expected [$2], got [$3]"
    FAILURES=$((FAILURES + 1))
  fi
}

# ── Postgres (initdb refuses root; drop to an unprivileged user if needed) ───
asPg() {
  if [ "$(id -u)" = "0" ]; then
    runuser -u pguser -- "$@"
  else
    "$@"
  fi
}
if [ "$(id -u)" = "0" ]; then
  id pguser >/dev/null 2>&1 || useradd -m pguser
  chown -R pguser "$WORK"
fi
asPg "$PGBIN/initdb" -D "$WORK/pg" -U docrai --auth=trust >/dev/null 2>&1 || { echo "initdb failed"; exit 1; }
asPg "$PGBIN/pg_ctl" -D "$WORK/pg" -o "-p $PGPORT -k $WORK -h 127.0.0.1" -l "$WORK/pg.log" start >/dev/null || { echo "pg start failed"; cat "$WORK/pg.log"; exit 1; }
asPg "$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U docrai docrai_e2e >/dev/null 2>&1
# Exercise the production upgrade path: this is the ledger schema that existed
# before attempt correlation and test-project classification were introduced.
asPg "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U docrai -d docrai_e2e -q -c \
  "CREATE TABLE report_generations (id BIGSERIAL PRIMARY KEY, tester_token VARCHAR, project_id TEXT, doc_id TEXT, status TEXT NOT NULL DEFAULT 'success', created_at TIMESTAMPTZ NOT NULL DEFAULT now())"

# ── API ───────────────────────────────────────────────────────────────────────
cd "$API_DIR"
DATABASE_URL="postgresql://docrai@127.0.0.1:${PGPORT}/docrai_e2e" \
DATABASE_SSL=false \
TESTER_TOKEN="$TOKEN" \
PORT="$APIPORT" \
MEDIA_DIR="$WORK/media" \
STATIC_DIR="$WORK/no-static" \
AI_ENGINE_URL= \
node src/index.js >"$WORK/api.log" 2>&1 &
API_PID=$!

for _ in $(seq 1 40); do
  curl -sf "$BASE/health" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "$BASE/health" >/dev/null || { echo "API never became healthy"; cat "$WORK/api.log"; exit 1; }

# ── Seed: project + media ────────────────────────────────────────────────────
PROJECT='{"project":{"id":"p1","name":"Solbergveien 14, Rykkinn","inspectionDate":"2026-08-04","inspector":"Kari Nordmann","updatedAt":"2026-08-04T10:00:00Z","notes":[{"id":"n1","text":"Fuktskjolder ved sluk","createdAt":"2026-08-04T08:12:00Z","photos":[{"id":"ph1","uri":"local","caption":"Sluk i kjeller","remoteId":"__MEDIA__","geo":{"lat":59.94,"lng":10.52},"capturedAt":"2026-08-04T08:12:44Z"}]}],"reportMeta":{"addressStreet":"Solbergveien 14","addressPostcodeCity":"1349 Rykkinn","summaryText":"Gradvis fuktinntrengning ved sluk."}}}'

echo "test-image-bytes-$(date +%s)" > "$WORK/evidence.jpg"
# CI-flake-vern: /health svarer før de idempotente CREATE TABLE-ene er ferdige,
# så det aller første DB-avhengige kallet kan treffe en halvferdig base. Retry
# til opplastingen faktisk gir en id (maks ~5 s) i stedet for å feile på racen.
MEDIA_JSON=""
for _ in $(seq 1 10); do
  MEDIA_JSON=$(curl -s -X POST "$BASE/api/media" -H "x-tester-token: $TOKEN" -F "file=@$WORK/evidence.jpg;type=image/jpeg" -F "projectId=p1" -F "kind=photo")
  [ "$(echo "$MEDIA_JSON" | jq -r '.id // empty')" != "" ] && break
  sleep 0.5
done
MEDIA_ID=$(echo "$MEDIA_JSON" | jq -r '.id')
check "media upload returns id" "true" "$([ -n "$MEDIA_ID" ] && [ "$MEDIA_ID" != "null" ] && echo true)"
MEDIA_SHA=$(echo "$MEDIA_JSON" | jq -r '.sha256 // empty')
if [ -n "$MEDIA_SHA" ]; then
  LOCAL_SHA=$(sha256sum "$WORK/evidence.jpg" | cut -d' ' -f1)
  check "media sha256 matches file" "$LOCAL_SHA" "$MEDIA_SHA"
else
  echo "note media sha256 not present yet (hash agent not merged?)"
fi

PROJECT_FINAL=${PROJECT/__MEDIA__/$MEDIA_ID}
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/projects/p1" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d "$PROJECT_FINAL")
check "project upsert" "200" "$STATUS"

# ── Approval gate ────────────────────────────────────────────────────────────
# Uten godkjenningsstempel er rapporten et AI-utkast og kan ikke deles.
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/share" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d '{"projectId":"p1"}')
check "share for unapproved report rejected" "409" "$STATUS"

PROJECT_APPROVED=$(echo "$PROJECT_FINAL" | jq -c '
  .project.reportApproval={"approvedBy":"Kari Nordmann","approvedAt":"2026-08-04T11:00:00Z"}
  | .project.updatedAt="2026-08-04T11:00:00Z"
  | .project.reportDraft={"at":"2026-08-04T10:30:00Z","content":{"area":"Kjeller bad","cause":"Utett klemring ved sluk - akutt hendelse","description":"Fuktskjolder ved sluk."}}
  | .project.reportFinal={"at":"2026-08-04T10:55:00Z","content":{"area":"Kjeller bad","cause":"Utett klemring ved sluk - gradvis inntrengning over uker","description":"Fuktskjolder ved sluk."}}')
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/projects/p1" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d "$PROJECT_APPROVED")
check "project upsert with approval" "200" "$STATUS"

# ── Create shares ────────────────────────────────────────────────────────────
SHARE=$(curl -s -X POST "$BASE/api/share" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d '{"projectId":"p1"}')
SHARE_ID=$(echo "$SHARE" | jq -r '.shareId'); PIN=$(echo "$SHARE" | jq -r '.pin')
check "share created with 6-digit pin" "6" "${#PIN}"

LOCK=$(curl -s -X POST "$BASE/api/share" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d '{"projectId":"p1"}')
LOCK_ID=$(echo "$LOCK" | jq -r '.shareId')

STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/share" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d '{"projectId":"finnes-ikke"}')
check "share for unknown project rejected" "404" "$STATUS"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/share" -H 'Content-Type: application/json' -d '{"projectId":"p1"}')
check "share creation requires tester token" "401" "$STATUS"

# ── PIN gate ─────────────────────────────────────────────────────────────────
STATE=$(curl -s "$BASE/api/share/$SHARE_ID/meta" | jq -r '.state')
check "meta is active" "active" "$STATE"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/share/finnes-ikke-id/meta")
check "unknown share id yields 410" "410" "$STATUS"

WRONG_PIN=$(printf '%06d' $(( (10#$PIN + 1) % 1000000 )))
for i in 1 2 3 4 5; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/share/$LOCK_ID/unlock" -H 'Content-Type: application/json' -d "{\"pin\":\"$WRONG_PIN\"}")
  check "wrong pin attempt $i rejected" "401" "$STATUS"
done
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/share/$LOCK_ID/unlock" -H 'Content-Type: application/json' -d "{\"pin\":\"$WRONG_PIN\"}")
check "6th attempt locked out" "429" "$STATUS"

VT=$(curl -s -X POST "$BASE/api/share/$SHARE_ID/unlock" -H 'Content-Type: application/json' -d "{\"pin\":\"$PIN\"}" | jq -r '.viewToken')
check "correct pin unlocks" "true" "$([ -n "$VT" ] && [ "$VT" != "null" ] && echo true)"

# ── Recipient endpoints ──────────────────────────────────────────────────────
REPORT=$(curl -s "$BASE/api/share/$SHARE_ID/report?vt=$VT")
check "report name" "Solbergveien 14, Rykkinn" "$(echo "$REPORT" | jq -r '.report.name')"
check "report carries approval stamp" "Kari Nordmann" "$(echo "$REPORT" | jq -r '.report.approval.approvedBy')"
check "report carries final content" "Utett klemring ved sluk - gradvis inntrengning over uker" "$(echo "$REPORT" | jq -r '.report.content.cause')"
check "report diff lists corrected field" "cause" "$(echo "$REPORT" | jq -r '.report.draftChangedFields[0]')"
check "report photo media id" "$MEDIA_ID" "$(echo "$REPORT" | jq -r '.report.notes[0].photos[0].mediaId')"
check "report geo flows through" "59.94" "$(echo "$REPORT" | jq -r '.report.notes[0].photos[0].geo.lat')"
check "report never leaks tester token" "" "$(echo "$REPORT" | grep -o "$TOKEN")"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/share/$SHARE_ID/report?vt=tull.tull")
check "bad view token rejected" "401" "$STATUS"

BODY=$(curl -s "$BASE/api/share/$SHARE_ID/media/$MEDIA_ID?vt=$VT")
check "media streams via share" "$(cat "$WORK/evidence.jpg")" "$BODY"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/share/$SHARE_ID/media/annet-prosjekt-media?vt=$VT")
check "foreign media id rejected" "404" "$STATUS"

# ── Lesetids-godkjenningsport ────────────────────────────────────────────────
# Porten gjelder hele lenkens levetid: trekkes godkjenningen, skal en AKTIV
# lenke slutte å servere både rapport og media — og virke igjen ved ny
# godkjenning (sjekken skjer ved lesing, ikke bare ved opprettelse).
PROJECT_UNAPPROVED=$(echo "$PROJECT_APPROVED" | jq -c 'del(.project.reportApproval) | .project.updatedAt="2026-08-04T12:00:00Z"')
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/projects/p1" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d "$PROJECT_UNAPPROVED")
check "approval withdrawn upsert" "200" "$STATUS"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/share/$SHARE_ID/report?vt=$VT")
check "live link blocked after approval withdrawn" "410" "$STATUS"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/share/$SHARE_ID/media/$MEDIA_ID?vt=$VT")
check "live media blocked after approval withdrawn" "410" "$STATUS"

PROJECT_REAPPROVED=$(echo "$PROJECT_APPROVED" | jq -c '.project.updatedAt="2026-08-04T13:00:00Z" | .project.e2eUnknownField="behold-meg"')
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/projects/p1" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d "$PROJECT_REAPPROVED")
check "re-approval upsert" "200" "$STATUS"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/share/$SHARE_ID/report?vt=$VT")
check "link active again after re-approval" "200" "$STATUS"

# ── Ukjent-felt-rundtur (skjemaevolusjon) ────────────────────────────────────
# Et felt bare en nyere klientversjon kjenner skal overleve lagring/lesing —
# egenskapen finnes i dag kun implisitt (spread overalt); denne freder den.
UNKNOWN=$(curl -s "$BASE/api/projects/p1" -H "x-tester-token: $TOKEN" | jq -r '.project.e2eUnknownField')
check "unknown field survives round-trip" "behold-meg" "$UNKNOWN"

# ── Stale PUT rekker flettegrunnlaget tilbake (LWW-vakt) ─────────────────────
STALE=$(curl -s -X PUT "$BASE/api/projects/p1" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d "$(echo "$PROJECT_APPROVED" | jq -c '.project.updatedAt="2026-08-04T09:00:00Z" | .project.name="Gammel kopi"')")
check "stale put flagged" "true" "$(echo "$STALE" | jq -r '.stale')"
check "stale put returns newer copy" "Solbergveien 14, Rykkinn" "$(echo "$STALE" | jq -r '.project.name')"

# ── Idempotent medieopplasting (sha256-dedup) ────────────────────────────────
DUP_JSON=$(curl -s -X POST "$BASE/api/media" -H "x-tester-token: $TOKEN" -F "file=@$WORK/evidence.jpg;type=image/jpeg" -F "projectId=p1" -F "kind=photo")
check "duplicate upload reuses id" "$MEDIA_ID" "$(echo "$DUP_JSON" | jq -r '.id')"

# ── iPhone-video (.mov): whitelistet endelse + riktig MIME ved servering ─────
# Regresjon for pilotfunn 28.08: .mov ble strippet til endelsesløs fil med
# application/octet-stream, og Gemini avviste hele rapportkjøringen.
printf 'fake-mov-bytes-%s' "$RANDOM" > "$WORK/befaring.mov"
MOV_JSON=$(curl -s -X POST "$BASE/api/media" -H "x-tester-token: $TOKEN" -F "file=@$WORK/befaring.mov;type=video/quicktime" -F "projectId=p1" -F "kind=video")
MOV_ID=$(echo "$MOV_JSON" | jq -r '.id')
check "mov upload accepted" "yes" "$([ -n "$MOV_ID" ] && [ "$MOV_ID" != "null" ] && echo yes || echo no)"
MOV_CT=$(curl -s -o /dev/null -D - "$BASE/api/media/$MOV_ID" -H "x-tester-token: $TOKEN" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type" {print $2}')
check "mov served as video/quicktime" "video/quicktime" "$MOV_CT"

# ── Transcribe-kontrakt: JSON {audioRemoteId} ────────────────────────────────
# Uten Gemini-nøkkel i e2e: en ukjent id skal gi 404 (kontrakten forstås) —
# ikke 400 «No file uploaded» slik den gamle JSON-kontrakten alltid fikk.
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/transcribe" -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -d '{"audioRemoteId":"finnes-ikke"}')
check "transcribe accepts audioRemoteId contract" "404" "$STATUS"

# ── Rapportstatus fra hovedboka (report_generations) ─────────────────────────
# Gjenopprettingsflyten: tom hovedbok → null; suksessrad → status + avledet
# dokument-URL, så en klient som mistet svaret kan gjenfinne dokumentet.
RSTATUS=$(curl -s "$BASE/report/status/proj-status-test" -H "x-tester-token: $TOKEN")
check "report status: empty ledger" "false null" "$(echo "$RSTATUS" | jq -r '"\(.inFlight) \(.latest)"')"
asPg "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U docrai -d docrai_e2e -q -c \
  "INSERT INTO report_generations (tester_token, project_id, doc_id, status, is_test_project) VALUES ('$TOKEN', 'proj-status-test', 'DOC123abc', 'success', TRUE)"
RSTATUS=$(curl -s "$BASE/report/status/proj-status-test" -H "x-tester-token: $TOKEN")
check "report status: success row visible" "success" "$(echo "$RSTATUS" | jq -r '.latest.status')"
check "report status: test run identified" "true" "$(echo "$RSTATUS" | jq -r '.latest.isTestProject')"
check "report status: url derived from doc_id" \
  "https://docs.google.com/document/d/DOC123abc/edit" "$(echo "$RSTATUS" | jq -r '.latest.url')"
# Skjemavakt for kvalitetskolonnene: recordReportGeneration i index.js skriver
# åtte kolonner, men kjøres bare via ekte motor. Feiler denne INSERT-en, ville
# hovedbokraden gått tapt stille i drift (insert-feil logges kun).
INS=$(PGOPTIONS='-c client_min_messages=warning' asPg "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U docrai -d docrai_e2e -q -tA -c \
  "INSERT INTO report_generations (tester_token, project_id, doc_id, status, prompt_version, citations_proposed, citations_verified, citations_rejected)
   VALUES ('$TOKEN', 'proj-status-test', 'DOC456def', 'success', 'e2e-v0', 3, 2, 1)
   RETURNING prompt_version || ':' || citations_proposed || '/' || citations_verified || '/' || citations_rejected" 2>&1)
check "report_generations: 8-column insert (prompt_version + citations)" "e2e-v0:3/2/1" "$INS"

# ── Cookiefri besøkstelling: allowlistet sti telles, ukjent sti ignoreres ───
curl -s -o /dev/null -X POST "$BASE/api/besok" -H 'Content-Type: application/json' -d '{"sti":"/kontakt","kilde":"e2e"}'
curl -s -o /dev/null -X POST "$BASE/api/besok" -H 'Content-Type: application/json' -d '{"sti":"/finnes-ikke"}'
BESOK=$(PGOPTIONS='-c client_min_messages=warning' asPg "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U docrai -d docrai_e2e -q -tA -c \
  "SELECT sti || ':' || coalesce(kilde,'-') FROM sidevisninger ORDER BY id" 2>&1 | tr '\n' ' ')
check "besok: /kontakt telles med kilde, ukjent sti ignoreres" "/kontakt:e2e " "$BESOK"

# ── Share page shell ─────────────────────────────────────────────────────────
PAGE=$(curl -s "$BASE/share/$SHARE_ID")
check "share page served" "true" "$(echo "$PAGE" | grep -q 'PIN-koden' && echo true)"

# ── Revoke ───────────────────────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/share/$SHARE_ID" -H "x-tester-token: $TOKEN")
check "owner revokes" "200" "$STATUS"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/share/$SHARE_ID/report?vt=$VT")
check "revoked share blocks report" "410" "$STATUS"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/share/$SHARE_ID/meta")
check "revoked meta is gone" "410" "$STATUS"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "E2E: all checks passed"
else
  echo "E2E: $FAILURES check(s) FAILED"
  exit 1
fi
