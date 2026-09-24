#!/usr/bin/env bash
# E2E: Host-allowliste (S20), sikkerhetsheadere, /.well-known + security.txt,
# HSTS-trapp, loggmaskering og signert medie-URL til AI-motoren. Uten Postgres.
#
# Tre servere med ulik konfigurasjon + en stub som spiller AI-motor:
#   A: ingen PUBLIC_BASE_URL / SECURITY_CONTACT / HSTS_MAX_AGE, ingen STATIC_DIR
#      → fallback-atferden (ond Host må ALDRI reflekteres). AI_ENGINE_URL → stub.
#   B: alle tre satt + STATIC_DIR med index.html (som på Render) → env vinner,
#      security.txt serveres også til nettlesere (Accept: text/html), HSTS på.
#   C: NODE_ENV=production med UGYLDIGE verdier → avvises i logg, fallback,
#      security.txt 404, HSTS av, loopback ikke allowlistet.
# Porter kan overstyres (PORT_A/PORT_B/PORT_C/PORT_STUB) for parallelle kjøringer.
# Usage: bash test/e2e-headere.sh   (from apps/api)
set -u

API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PORT_A="${PORT_A:-8094}"
PORT_B="${PORT_B:-8095}"
PORT_C="${PORT_C:-8096}"
PORT_STUB="${PORT_STUB:-8099}"
TOKEN="e2e-hdr-token"
A="http://127.0.0.1:${PORT_A}"
B="http://127.0.0.1:${PORT_B}"
C="http://127.0.0.1:${PORT_C}"
FALLBACK="https://janitorai-backend.onrender.com"
EVIL_HOST='evil"><script>alert(1)</script><x y="'
FAILURES=0
CHECKS=0

cleanup() {
  for pid in "${A_PID:-}" "${B_PID:-}" "${C_PID:-}" "${STUB_PID:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  rm -rf "$WORK"
}
trap cleanup EXIT

check() { # check <name> <expected> <actual>
  CHECKS=$((CHECKS + 1))
  if [ "$2" = "$3" ]; then
    echo "ok   $1"
  else
    echo "FAIL $1 — expected [$2], got [$3]"
    FAILURES=$((FAILURES + 1))
  fi
}

# Alle curl-kall har tidsavbrudd: en hengende server skal gi FAIL, ikke en jobb
# som står i 6 timer i CI.
CURL="curl -s -m 5"
# header <name> <curl-args…> → verdien av første treff (tom hvis ingen)
header() {
  local name="$1"; shift
  $CURL -o /dev/null -D - "$@" | tr -d '\r' | grep -i "^${name}: " | head -1 | sed 's/^[^:]*: //'
}
# status_header <name> <curl-args…> → "<status>|<verdi>" — en TOM forventning
# bevises sammen med at serveren faktisk svarte (ellers er «tom» også det en
# død server gir).
status_header() {
  local name="$1"; shift
  local out
  out="$($CURL -o /dev/null -w '\n%{http_code}' -D - "$@" | tr -d '\r')"
  printf '%s|%s' "$(printf '%s' "$out" | tail -1)" \
    "$(printf '%s' "$out" | grep -i "^${name}: " | head -1 | sed 's/^[^:]*: //')"
}
status() { $CURL -o /dev/null -w '%{http_code}' "$@"; }
canonical() { grep -o '<link rel="canonical" href="[^"]*"' | head -1 | sed 's/.*href="//; s/"$//'; }

# ── Preflight: verktøy og ledige porter (ellers tester vi en fremmed server) ─
for tool in jq curl node; do
  command -v "$tool" >/dev/null 2>&1 || { echo "FAIL mangler verktøy: $tool"; exit 1; }
done
for p in "$PORT_A" "$PORT_B" "$PORT_C" "$PORT_STUB"; do
  if curl -s -m 1 -o /dev/null "http://127.0.0.1:$p/" 2>/dev/null; then
    echo "FAIL port $p er opptatt (stale server eller parallell kjøring) — sett PORT_A/PORT_B/PORT_C/PORT_STUB"
    exit 1
  fi
done

cd "$API_DIR"

# Stub som spiller AI-motor: lagrer request-kroppen så vi kan lese video_url.
node -e '
const fs = require("fs");
require("http").createServer((q, r) => {
  let b = ""; q.on("data", (c) => (b += c));
  q.on("end", () => { fs.writeFileSync(process.argv[1], b); r.setHeader("content-type", "application/json"); r.end(JSON.stringify({ status: "success", url: "https://docs.google.com/document/d/stub" })); });
}).listen(Number(process.argv[2]), "127.0.0.1");
' "$WORK/engine-body.json" "$PORT_STUB" >"$WORK/stub.log" 2>&1 &
STUB_PID=$!

mkdir -p "$WORK/static/.well-known"
printf '<!DOCTYPE html>\n<html><head><title>SPA</title></head><body>SPA INDEX</body></html>\n' >"$WORK/static/index.html"
printf '[{"relation":["delegate_permission/common.handle_all_urls"]}]\n' >"$WORK/static/.well-known/assetlinks.json"

env -u PUBLIC_BASE_URL -u API_BASE_URL -u SECURITY_CONTACT -u HSTS_MAX_AGE -u NODE_ENV \
  TESTER_TOKEN="$TOKEN" PORT="$PORT_A" MEDIA_DIR="$WORK/media-a" STATIC_DIR="$WORK/no-static" \
  AI_ENGINE_URL="http://127.0.0.1:${PORT_STUB}" AI_ENGINE_TOKEN="stub" \
  node src/index.js >"$WORK/a.log" 2>&1 &
A_PID=$!
# B: PUBLIC_BASE_URL og API_BASE_URL er ULIKE, så testen skiller publicBase
# (canonical/robots) fra apiBase (medie-URL til motor, admin-dashbord).
env -u NODE_ENV \
  TESTER_TOKEN="$TOKEN" PORT="$PORT_B" MEDIA_DIR="$WORK/media-b" STATIC_DIR="$WORK/static" \
  PUBLIC_BASE_URL="https://example.test/" API_BASE_URL="https://api-b.test" \
  AI_ENGINE_URL="http://127.0.0.1:${PORT_STUB}" AI_ENGINE_TOKEN="stub" \
  SECURITY_CONTACT="mailto:sikkerhet@example.test" HSTS_MAX_AGE=300 \
  node src/index.js >"$WORK/b.log" 2>&1 &
B_PID=$!
env TESTER_TOKEN="$TOKEN" PORT="$PORT_C" MEDIA_DIR="$WORK/media-c" STATIC_DIR="$WORK/no-static" \
  NODE_ENV=production \
  PUBLIC_BASE_URL="http://example.test" API_BASE_URL='https://evil.test/x"><script>' \
  SECURITY_CONTACT="fredrik@privat" HSTS_MAX_AGE=99999999999999999999 \
  node src/index.js >"$WORK/c.log" 2>&1 &
C_PID=$!

wait_up() { # wait_up <base> <log> <pid>
  for _ in $(seq 1 80); do
    if ! kill -0 "$3" 2>/dev/null; then
      echo "FAIL server $1 døde under oppstart"; cat "$2"; exit 1
    fi
    curl -sf -m 2 "$1/health" >/dev/null 2>&1 && return 0
    sleep 0.25
  done
  echo "FAIL server $1 kom aldri opp"; cat "$2"; exit 1
}
wait_up "$A" "$WORK/a.log" "$A_PID"
wait_up "$B" "$WORK/b.log" "$B_PID"
wait_up "$C" "$WORK/c.log" "$C_PID"

# ── (i) S20: ond Host reflekteres aldri; ukjent vert → fast fallback ─────────
OM_EVIL="$($CURL -H "Host: $EVIL_HOST" "$A/om")"
check "S20 /om: ond Host gir ikke script i svaret" "0" "$(printf '%s' "$OM_EVIL" | grep -c '<script>alert')"
check "S20 /om: canonical faller tilbake til fast vert" "$FALLBACK/om" "$(printf '%s' "$OM_EVIL" | canonical)"
check "S20 /om: og:url på fast vert" "1" "$(printf '%s' "$OM_EVIL" | grep -c "<meta property=\"og:url\" content=\"$FALLBACK/om\"")"
check "S20 /om: JSON-LD url på fast vert" "yes" "$([ "$(printf '%s' "$OM_EVIL" | grep -c "\"url\":\"$FALLBACK/om\"")" -ge 1 ] && echo yes || echo no)"
SM="$($CURL -H "Host: $EVIL_HOST" "$A/sitemap.xml")"
check "S20 sitemap: ingen script" "0" "$(printf '%s' "$SM" | grep -c '<script')"
check "S20 sitemap: 7 loc" "7" "$(printf '%s' "$SM" | grep -c '<loc>')"
check "S20 sitemap: alle loc på fast vert" "7" "$(printf '%s' "$SM" | grep -c "<loc>$FALLBACK/")"
RB="$($CURL -H "Host: $EVIL_HOST" "$A/robots.txt")"
check "S20 robots: én Sitemap-linje" "1" "$(printf '%s\n' "$RB" | grep -c '^Sitemap:')"
check "S20 robots: Sitemap på fast vert" "Sitemap: $FALLBACK/sitemap.xml" "$(printf '%s\n' "$RB" | grep '^Sitemap:')"
check "allowlistet loopback gir egen vert i canonical" "http://127.0.0.1:$PORT_A/om" "$($CURL "$A/om" | canonical)"
check "X-Forwarded-Host påvirker ikke basen" "http://127.0.0.1:$PORT_A/om" "$($CURL -H 'X-Forwarded-Host: evil.example' "$A/om" | canonical)"
check "admin-dashboard: API-base normalisert, ikke rå env" "1" "$($CURL "$A/admin-dashboard" | grep -c "const APP_API_BASE = 'http://127.0.0.1:$PORT_A';")"

# ── (ii) env vinner, trailing slash strippet — også med STATIC_DIR (B) ──────
check "PUBLIC_BASE_URL vinner over ond Host (/om)" "https://example.test/om" "$($CURL -H "Host: $EVIL_HOST" "$B/om" | canonical)"
check "PUBLIC_BASE_URL vinner i robots" "Sitemap: https://example.test/sitemap.xml" "$($CURL -H "Host: $EVIL_HOST" "$B/robots.txt" | grep '^Sitemap:')"

# ── (iii) X-Robots-Tag per prefiks (segmentmatch, case-ufølsom) ─────────────
NOIDX="noindex, nofollow"
check "noindex: /share/abc" "$NOIDX" "$(header x-robots-tag "$A/share/abc")"
check "noindex: /admin-dashboard" "$NOIDX" "$(header x-robots-tag "$A/admin-dashboard")"
check "noindex: /ADMIN-DASHBOARD (Express ruter case-ufølsomt)" "$NOIDX" "$(header x-robots-tag "$A/ADMIN-DASHBOARD")"
check "noindex: /presentation" "$NOIDX" "$(header x-robots-tag "$A/presentation")"
check "noindex: /api/share/abc/meta" "$NOIDX" "$(header x-robots-tag "$A/api/share/abc/meta")"
check "noindex: /api/media/x (header uansett status)" "$NOIDX" "$(header x-robots-tag "$A/api/media/x")"
check "salgsside /om er indekserbar (200, ingen X-Robots-Tag)" "200|" "$(status_header x-robots-tag "$A/om")"
check "segmentmatch: /share-info treffer ikke /share (404, ingen header)" "404|" "$(status_header x-robots-tag -H 'Accept: text/html' "$A/share-info")"
check "headere også på CORS-preflight (nosniff)" "204|nosniff" "$(status_header x-content-type-options -X OPTIONS -H 'Origin: http://x' -H 'Access-Control-Request-Method: POST' "$A/api/projects")"
check "X-Frame-Options på salgsside" "SAMEORIGIN" "$(header x-frame-options "$A/om")"
check "Referrer-Policy på salgsside" "strict-origin-when-cross-origin" "$(header referrer-policy "$A/om")"
check "nosniff + X-Frame-Options også på 401 fra token-vakten" "401|SAMEORIGIN" "$(status_header x-frame-options "$A/whoami")"

# ── (iv) Delings-svar caches aldri ──────────────────────────────────────────
check "no-store på /api/share/*/meta (503 uten DB, header før requireDb)" "no-store" "$(header cache-control "$A/api/share/abc/meta")"

# ── (v) /.well-known: 404, aldri 401; token-vakten ellers uendret ───────────
check "/.well-known/x → 404" "404" "$(status "$A/.well-known/x")"
check "/.well-known/security.txt uten SECURITY_CONTACT → 404 (fail-closed)" "404" "$(status "$A/.well-known/security.txt")"
check "regresjon: /whoami uten token → 401" "401" "$(status "$A/whoami")"
check "regresjon: /api/tull.json uten token → 401" "401" "$(status "$A/api/tull.json")"
check "regresjon: /finnes-ikke med Accept html → 404" "404" "$(status -H 'Accept: text/html' "$A/finnes-ikke")"

# ── (vi) security.txt på B — også for nettlesere, foran SPA-fallbacken ──────
check "security.txt → 200" "200" "$(status "$B/.well-known/security.txt")"
check "security.txt content-type" "text/plain; charset=utf-8" "$(header content-type "$B/.well-known/security.txt")"
check "security.txt med Accept: text/html (nettleser) → fila, ikke SPA" "200|text/plain; charset=utf-8" \
  "$(status_header content-type -H 'Accept: text/html,application/xhtml+xml,*/*;q=0.8' "$B/.well-known/security.txt")"
check "/.well-known/x med Accept: text/html → 404, ikke SPA" "404" "$(status -H 'Accept: text/html' "$B/.well-known/x")"
check "STATIC_DIR/.well-known/assetlinks.json serveres foran routeren (App Links)" "200|application/json; charset=utf-8" \
  "$(status_header content-type "$B/.well-known/assetlinks.json")"
check "SPA-fallback virker fortsatt for appen på B" "SPA INDEX" "$($CURL -H 'Accept: text/html' "$B/projects/123" | grep -o 'SPA INDEX')"
SEC="$($CURL "$B/.well-known/security.txt")"
check "security.txt Contact fra env" "Contact: mailto:sikkerhet@example.test" "$(printf '%s\n' "$SEC" | grep '^Contact:')"
check "security.txt Canonical på PUBLIC_BASE_URL" "Canonical: https://example.test/.well-known/security.txt" "$(printf '%s\n' "$SEC" | grep '^Canonical:')"
EXP="$(printf '%s\n' "$SEC" | grep '^Expires:' | sed 's/^Expires: //')"
check "security.txt Expires er RFC 3339 (UTC)" "yes" "$(printf '%s' "$EXP" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' && echo yes || echo no)"
check "security.txt Expires ligger i framtiden" "yes" "$([ "$(date -u -d "$EXP" +%s 2>/dev/null || echo 0)" -gt "$(date -u +%s)" ] && echo yes || echo no)"

# ── (vii) HSTS: kun bak TLS (X-Forwarded-Proto), kun max-age ────────────────
check "HSTS på B bak https" "max-age=300" "$(header strict-transport-security -H 'X-Forwarded-Proto: https' "$B/health")"
check "ingen HSTS på B over http (200, tom)" "200|" "$(status_header strict-transport-security "$B/health")"
check "ingen HSTS på A (HSTS_MAX_AGE usatt)" "200|" "$(status_header strict-transport-security -H 'X-Forwarded-Proto: https' "$A/health")"
check "HSTS uten preload/includeSubDomains" "0" "$(header strict-transport-security -H 'X-Forwarded-Proto: https' "$B/health" | grep -ci 'preload\|includesubdomains')"

# ── (viii) Ugyldig env (C, produksjon): avvist i logg, fallback, fail-closed ─
check "prod: http PUBLIC_BASE_URL avvises (logg)" "1" "$(grep -c 'PUBLIC_BASE_URL er ugyldig' "$WORK/c.log")"
check "prod: ugyldig API_BASE_URL avvises (logg)" "1" "$(grep -c 'API_BASE_URL er ugyldig' "$WORK/c.log")"
check "prod: ugyldig SECURITY_CONTACT avvises (logg)" "1" "$(grep -c 'SECURITY_CONTACT er ugyldig' "$WORK/c.log")"
check "prod: HSTS_MAX_AGE over tak (1e20 → «max-age=1e+20») avvises (logg)" "1" "$(grep -c 'HSTS_MAX_AGE er ugyldig' "$WORK/c.log")"
check "prod: ugyldig base → fast fallback i canonical, loopback ikke allowlistet" "$FALLBACK/om" "$($CURL "$C/om" | canonical)"
check "prod: ond Host → fast fallback" "$FALLBACK/om" "$($CURL -H "Host: $EVIL_HOST" "$C/om" | canonical)"
check "prod: ugyldig SECURITY_CONTACT → security.txt 404" "404" "$(status "$C/.well-known/security.txt")"
check "prod: ugyldig HSTS_MAX_AGE → ingen HSTS (200, tom)" "200|" "$(status_header strict-transport-security -H 'X-Forwarded-Proto: https' "$C/health")"

# ── (ix) S20 kjerne: signert medie-URL til AI-motoren bruker aldri rå Host ──
rm -f "$WORK/engine-body.json"
curl -s -m 20 -o /dev/null -X POST "$A/report/google-doc" -H "x-tester-token: $TOKEN" \
  -H 'Content-Type: application/json' -H "Host: $EVIL_HOST" \
  -d '{"video_filename":"v1","project":{},"project_id":"p1"}'
VIDEO_URL="$(jq -r '.video_url // empty' "$WORK/engine-body.json" 2>/dev/null)"
check "S20 medie-URL til AI-motor: fast vert, aldri rå Host" "$FALLBACK/api/media/v1" "$(printf '%s' "$VIDEO_URL" | sed 's/?.*//')"
check "S20 medie-URL er signert (sig= og exp=)" "yes" "$(printf '%s' "$VIDEO_URL" | grep -q 'sig=' && printf '%s' "$VIDEO_URL" | grep -q 'exp=' && echo yes || echo no)"
# apiBase ≠ publicBase: på B skal medie-URL og admin-base følge API_BASE_URL,
# mens canonical følger PUBLIC_BASE_URL (to-tjeneste-kontrakten i RENDER_SETUP).
rm -f "$WORK/engine-body.json"
curl -s -m 20 -o /dev/null -X POST "$B/report/google-doc" -H "x-tester-token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"video_filename":"v2","project":{},"project_id":"p2"}'
check "apiBase: medie-URL til motor følger API_BASE_URL, ikke PUBLIC_BASE_URL" "https://api-b.test/api/media/v2" \
  "$(jq -r '.video_url // empty' "$WORK/engine-body.json" 2>/dev/null | sed 's/?.*//')"
check "apiBase: admin-dashboard følger API_BASE_URL" "1" "$($CURL "$B/admin-dashboard" | grep -c "const APP_API_BASE = 'https://api-b.test';")"
check "publicBase: canonical på B følger fortsatt PUBLIC_BASE_URL" "https://example.test/om" "$($CURL "$B/om" | canonical)"

# ── (x) vt=/sig=/token=/adresse= maskeres i request-loggen, også kodet ───────
$CURL -o /dev/null "$A/api/share/abc/report?vt=HEMMELIGVT&sig=HEMMELIGSIG&token=HEMMELIGTOKEN"
$CURL -o /dev/null "$A/api/media/mid?%74oken=HEMMELIGKODET"
$CURL -o /dev/null "$A/api/demo/underlag?adresse=HEMMELIGADRESSE%201"
$CURL -o /dev/null -H "x-tester-token: $TOKEN" "$A/api/underlag/adresse?sok=HEMMELIGGATE%2012"
$CURL -o /dev/null -H "x-tester-token: $TOKEN" "$A/api/underlag/vaer?lat=HEMMELIGLAT&lon=HEMMELIGLON&date=2026-09-23"
sleep 0.5
check "loggen inneholder ingen av verdiene" "0" "$(grep -c 'HEMMELIG' "$WORK/a.log")"
check "loggen viser maskert vt=/sig=/token=" "1" "$(grep -c 'vt=\[redacted\]&sig=\[redacted\]&token=\[redacted\]' "$WORK/a.log")"
check "loggen maskerer prosent-kodet nøkkel (%74oken)" "1" "$(grep -c '%74oken=\[redacted\]' "$WORK/a.log")"
check "loggen maskerer adresse= (demo-søk)" "1" "$(grep -c 'adresse=\[redacted\]' "$WORK/a.log")"
check "loggen maskerer sok= (befaringsadresse, autentisert)" "1" "$(grep -c 'sok=\[redacted\]' "$WORK/a.log")"
check "loggen maskerer lat=/lon= men ikke date=" "1" "$(grep -c 'lat=\[redacted\]&lon=\[redacted\]&date=2026-09-23' "$WORK/a.log")"

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "$FAILURES of $CHECKS check(s) failed"
  echo "--- a.log"; tail -20 "$WORK/a.log"
  echo "--- b.log"; tail -20 "$WORK/b.log"
  echo "--- c.log"; tail -20 "$WORK/c.log"
  exit 1
fi
echo "All $CHECKS header checks passed"
