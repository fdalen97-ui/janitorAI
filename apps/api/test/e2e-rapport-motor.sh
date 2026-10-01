#!/usr/bin/env bash
# E2E: rapportgenerering mot ekte Postgres og en stub som spiller AI-motor.
# Usage: bash test/e2e-rapport-motor.sh   (from apps/api)
# Requires: postgres 16 binaries, curl, jq, node.
#
# Dekker det e2e-headere.sh ikke kan (den kjører uten database, og
# rapporttjenesten krever DB for hovedbok og eierskapssjekk):
#   - POST /report/google-doc svarer 200 (regresjon: merge e2ae957 gjorde ruten
#     til 500 «video_filename is not defined»)
#   - S20: signert medie-URL til motoren bruker aldri rå Host
#   - apiBase: medie-URL følger API_BASE_URL, ikke PUBLIC_BASE_URL
#   - hovedboken lagrer prompt_version og sitatportens telling per kjøring
#   - video som testeren ikke eier gir 404
#   - appens prosjektsnapshot (`project` i kroppen) tar bildene med til motoren
#     som signerte URL-er (regresjon: appen sendte {uri} uten remoteId, og
#     serveren krever remoteId — ingen bilder nådde motoren)
# Porter kan overstyres (PGPORT/PORT_A/PORT_B/PORT_STUB) for parallelle kjøringer.
# Standardportene ligger under Linux' dynamiske portområde (32768–60999), så en
# utgående tilkobling fra et tidligere CI-steg ikke kan ha tatt dem (CI-feil
# «could not bind … Address already in use» på 55442).
set -u

API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PGPORT="${PGPORT:-25442}"
PORT_A="${PORT_A:-18190}"
PORT_B="${PORT_B:-18191}"
PORT_STUB="${PORT_STUB:-18199}"
TOKEN="e2e-rapport-token"
A="http://127.0.0.1:${PORT_A}"
B="http://127.0.0.1:${PORT_B}"
EVIL_HOST="evil.test"
FALLBACK="https://janitorai-backend.onrender.com"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | head -1)"
FAILURES=0

cleanup() {
  for pid in "${A_PID:-}" "${B_PID:-}" "${STUB_PID:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
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
# Er porten likevel opptatt, prøv de neste i stedet for å feile på en tilfeldighet.
PG_STARTED=""
for try_port in "$PGPORT" $((PGPORT + 1)) $((PGPORT + 2)); do
  if asPg "$PGBIN/pg_ctl" -D "$WORK/pg" -o "-p $try_port -k $WORK -h 127.0.0.1" -l "$WORK/pg.log" start >/dev/null; then
    PGPORT="$try_port"; PG_STARTED=1; break
  fi
done
[ -n "$PG_STARTED" ] || { echo "pg start failed"; cat "$WORK/pg.log"; exit 1; }
asPg "$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U docrai docrai_e2e >/dev/null 2>&1
psqlq() {
  PGOPTIONS='-c client_min_messages=warning' asPg "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U docrai -d docrai_e2e -q -tA -c "$1" 2>&1
}

# ── Stub som spiller AI-motor: lagrer request-kroppen, svarer som motoren ───
node -e '
const http = require("http"), fs = require("fs");
http.createServer((q, r) => {
  let b = ""; q.on("data", (c) => (b += c));
  q.on("end", () => {
    fs.writeFileSync(process.argv[1], b);
    r.setHeader("content-type", "application/json");
    r.end(JSON.stringify({
      status: "success",
      url: "https://docs.google.com/document/d/e2estubdoc",
      analysis: { cause: "Nedbør mot grunnmur" },
      prompt_version: "e2e-2026-09-28",
      citation_stats: { proposed: 3, verified: 2, rejected: 1, unparseable: 0 },
    }));
  });
}).listen(+process.argv[2], "127.0.0.1");
' "$WORK/engine-body.json" "$PORT_STUB" >"$WORK/stub.log" 2>&1 &
STUB_PID=$!

# ── To API-servere mot samme base ────────────────────────────────────────────
# A: ingen base-env → fast fallback (ond Host må ALDRI reflekteres).
# B: API_BASE_URL ≠ PUBLIC_BASE_URL (to-tjeneste-kontrakten i RENDER_SETUP).
cd "$API_DIR"
start_api() { # start_api <port> <logfile> [VAR=verdi ...]
  local port="$1" log="$2"; shift 2
  env DATABASE_URL="postgresql://docrai@127.0.0.1:${PGPORT}/docrai_e2e" \
    DATABASE_SSL=false TESTER_TOKEN="$TOKEN" PORT="$port" \
    MEDIA_DIR="$WORK/media" STATIC_DIR="$WORK/no-static" \
    AI_ENGINE_URL="http://127.0.0.1:${PORT_STUB}" AI_ENGINE_TOKEN="stub" \
    "$@" node src/index.js >"$log" 2>&1 &
  echo $!
}
A_PID=$(start_api "$PORT_A" "$WORK/a.log")
B_PID=$(start_api "$PORT_B" "$WORK/b.log" API_BASE_URL="https://api-b.test" PUBLIC_BASE_URL="https://example.test")

for base in "$A" "$B"; do
  for _ in $(seq 1 40); do
    curl -sf "$base/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
  curl -sf "$base/health" >/dev/null || { echo "API $base never became healthy"; cat "$WORK/a.log" "$WORK/b.log"; exit 1; }
done

# ── Seed: ett medie (videoen motoren skal hente) og to prosjekter ────────────
echo "e2e-video-bytes-$(date +%s)" > "$WORK/befaring.jpg"
# /health svarer før de idempotente CREATE TABLE-ene er ferdige; retry den
# første DB-avhengige opplastingen (samme vern som i e2e-share.sh).
MEDIA_ID=""
for _ in $(seq 1 10); do
  MEDIA_ID=$(curl -s -X POST "$A/api/media" -H "x-tester-token: $TOKEN" \
    -F "file=@$WORK/befaring.jpg;type=image/jpeg" -F "projectId=r1" -F "kind=photo" | jq -r '.id // empty')
  [ -n "$MEDIA_ID" ] && break
  sleep 0.5
done
check "seed: medie lastet opp" "true" "$([ -n "$MEDIA_ID" ] && echo true)"

for pid_ in r1 r2; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$A/api/projects/$pid_" -H "x-tester-token: $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"project\":{\"id\":\"$pid_\",\"name\":\"Øvingsveien 12, Hamar\",\"updatedAt\":\"2026-09-28T10:00:00Z\",\"notes\":[{\"id\":\"n1\",\"text\":\"Fukt nederst på vegg\",\"createdAt\":\"2026-09-28T09:00:00Z\"}]}}")
  check "seed: prosjekt $pid_" "200" "$STATUS"
done

# ── Rapport på A med ond Host: 200, og medie-URL på fast vert, signert ───────
rm -f "$WORK/engine-body.json"
STATUS=$(curl -s -m 30 -o "$WORK/a-report.json" -w '%{http_code}' -X POST "$A/report/google-doc" \
  -H "x-tester-token: $TOKEN" -H 'Content-Type: application/json' -H "Host: $EVIL_HOST" \
  -d "{\"video_filename\":\"$MEDIA_ID\",\"project_id\":\"r1\",\"report_attempt_id\":\"e2e-a-1\"}")
check "rapport svarer 200 (ikke 500)" "200" "$STATUS"
check "rapport returnerer motorens URL" "https://docs.google.com/document/d/e2estubdoc" "$(jq -r '.url // empty' "$WORK/a-report.json")"
VIDEO_URL="$(jq -r '.video_url // empty' "$WORK/engine-body.json" 2>/dev/null)"
check "S20 medie-URL til AI-motor: fast vert, aldri rå Host" "$FALLBACK/api/media/$MEDIA_ID" "$(printf '%s' "$VIDEO_URL" | sed 's/?.*//')"
check "S20 medie-URL er signert (sig= og exp=)" "yes" \
  "$(printf '%s' "$VIDEO_URL" | grep -q 'sig=' && printf '%s' "$VIDEO_URL" | grep -q 'exp=' && echo yes || echo no)"

# ── Hovedboken: prompt-versjon og sitatportens telling bokført ───────────────
check "hovedbok: prompt_version og sitatport-telling lagret" "success|e2e-2026-09-28|3|2|1" \
  "$(psqlq "SELECT status||'|'||coalesce(prompt_version,'')||'|'||coalesce(citations_proposed::text,'')||'|'||coalesce(citations_verified::text,'')||'|'||coalesce(citations_rejected::text,'') FROM report_generations WHERE project_id='r1' AND attempt_id='e2e-a-1'")"

# ── B: medie-URL følger API_BASE_URL, ikke PUBLIC_BASE_URL ───────────────────
rm -f "$WORK/engine-body.json"
curl -s -m 30 -o /dev/null -X POST "$B/report/google-doc" -H "x-tester-token: $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"video_filename\":\"$MEDIA_ID\",\"project_id\":\"r2\",\"report_attempt_id\":\"e2e-b-1\"}"
check "apiBase: medie-URL til motor følger API_BASE_URL, ikke PUBLIC_BASE_URL" "https://api-b.test/api/media/$MEDIA_ID" \
  "$(jq -r '.video_url // empty' "$WORK/engine-body.json" 2>/dev/null | sed 's/?.*//')"

# ── Appens snapshot: bilder med remoteId når motoren som signerte URL-er ─────
# Kroppen speiler det appen sender i dag ([id].tsx: photos: [{remoteId, caption}]).
# Serveren skal bruke snapshotet, slå opp eierskap på remoteId, signere URL-en
# selv og legge bildeteksten ved. Et bilde uten remoteId skal utelates.
rm -f "$WORK/engine-body.json"
STATUS=$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X POST "$A/report/google-doc" -H "x-tester-token: $TOKEN" \
  -H 'Content-Type: application/json' -H "Host: $EVIL_HOST" \
  -d "{\"project_id\":\"r1\",\"report_attempt_id\":\"e2e-a-foto\",\"project\":{\"id\":\"r1\",\"name\":\"Øvingsveien 12, Hamar\",\"rooms\":[{\"id\":\"rom1\",\"name\":\"Kjeller\"}],\"notes\":[{\"roomId\":\"rom1\",\"text\":\"Fuktskjold nederst på vegg\",\"photos\":[{\"remoteId\":\"$MEDIA_ID\",\"caption\":\"Saltutslag ved gulv\"},{\"caption\":\"ikke lastet opp ennå\"}]}]}}")
check "snapshot: rapport svarer 200" "200" "$STATUS"
FOTO_URL="$(jq -r '.project.notes[0].photos[0].uri // empty' "$WORK/engine-body.json" 2>/dev/null)"
check "snapshot: bildet når motoren som signert URL på fast vert" "$FALLBACK/api/media/$MEDIA_ID" "$(printf '%s' "$FOTO_URL" | sed 's/?.*//')"
check "snapshot: bilde-URL er signert (sig= og exp=)" "yes" \
  "$(printf '%s' "$FOTO_URL" | grep -q 'sig=' && printf '%s' "$FOTO_URL" | grep -q 'exp=' && echo yes || echo no)"
check "snapshot: bildetekst og romnavn følger med" "Saltutslag ved gulv|Kjeller" \
  "$(jq -r '(.project.notes[0].photos[0].caption // "")+"|"+(.project.notes[0].room // "")' "$WORK/engine-body.json" 2>/dev/null)"
check "snapshot: bilde uten remoteId utelates" "1" "$(jq -r '.project.notes[0].photos | length' "$WORK/engine-body.json" 2>/dev/null)"

# ── Eierskap: en video testeren ikke eier gir 404, og motoren kalles ikke ────
rm -f "$WORK/engine-body.json"
STATUS=$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X POST "$A/report/google-doc" -H "x-tester-token: $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"video_filename":"finnes-ikke","project_id":"r1","report_attempt_id":"e2e-a-2"}')
check "fremmed video avvises (404)" "404" "$STATUS"
check "motoren kalles ikke for fremmed video" "no" "$([ -f "$WORK/engine-body.json" ] && echo yes || echo no)"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "RAPPORT-MOTOR: all checks passed"
else
  echo "RAPPORT-MOTOR: $FAILURES check(s) FAILED"
  echo "--- a.log"; tail -n 20 "$WORK/a.log"
  echo "--- b.log"; tail -n 20 "$WORK/b.log"
  exit 1
fi
