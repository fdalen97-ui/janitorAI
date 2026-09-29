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
  SECURITY_CONTACT="mailto:sikkerhet@example.test" HSTS_MAX_AGE=300 LANDING_ROOT=/om \
  node src/index.js >"$WORK/b.log" 2>&1 &
B_PID=$!
env TESTER_TOKEN="$TOKEN" PORT="$PORT_C" MEDIA_DIR="$WORK/media-c" STATIC_DIR="$WORK/no-static" \
  NODE_ENV=production \
  PUBLIC_BASE_URL="http://example.test" API_BASE_URL='https://evil.test/x"><script>' \
  SECURITY_CONTACT="fredrik@privat" HSTS_MAX_AGE=99999999999999999999 LANDING_ROOT="https://evil.test/" \
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
check "S20 sitemap: 8 loc" "8" "$(printf '%s' "$SM" | grep -c '<loc>')"
check "S20 sitemap: alle loc på fast vert" "8" "$(printf '%s' "$SM" | grep -c "<loc>$FALLBACK/")"
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
check "prod: LANDING_ROOT som URL avvises (logg)" "1" "$(grep -c 'LANDING_ROOT er ugyldig' "$WORK/c.log")"
check "prod: ugyldig LANDING_ROOT → roten redirecter ikke (ingen åpen redirect)" "404|" "$(status_header location -H 'Accept: text/html' "$C/")"

# ── (viii-b) LANDING_ROOT: roten → salgssiden, relativ sti, aldri URL ────────
check "LANDING_ROOT på B: / → 301 /om (også foran SPA-fallbacken)" "301|/om" "$(status_header location -H 'Accept: text/html' "$B/")"
check "LANDING_ROOT på B: redirect er relativ (ingen vert fra Host)" "301|/om" "$(status_header location -H "Host: $EVIL_HOST" "$B/")"
check "uten LANDING_ROOT (A): / → merkevare-404 som før" "404|" "$(status_header location -H 'Accept: text/html' "$A/")"

# ── (viii-c) Cache-Control på salgssidene, ingen X-Powered-By, UU-grunnmur ──
for p in /om /demo /eksempelrapport /faq /kontakt /personvern /vilkar /takk /kundereisen; do
  check "cache: $p → public, max-age=300" "200|public, max-age=300" "$(status_header cache-control "$A$p")"
done
check "cache: ikoner får max-age (7 dager)" "public, max-age=604800" "$(header cache-control "$A/favicon.png")"
check "cache: /share/:id får ikke fem minutters cache (sendFile-standard max-age=0)" "0" "$(header cache-control "$A/share/abc" | grep -c 'max-age=300')"
check "ingen X-Powered-By" "200|" "$(status_header x-powered-by "$A/om")"
for p in /om /demo /eksempelrapport /faq /kontakt /personvern /vilkar /takk; do
  PAGE="$($CURL "$A$p")"
  check "UU $p: lang=nb, <main>, h1" "1|1|yes" "$(printf '%s' "$PAGE" | grep -c '<html lang="nb">')|$(printf '%s' "$PAGE" | grep -c '<main')|$([ "$(printf '%s' "$PAGE" | grep -c '<h1')" -ge 1 ] && echo yes || echo no)"
done
# Delingsforhåndsvisning (Messenger/Facebook): absolutt bilde med mål, så
# forhåndsvisningen vises allerede første gang lenken deles.
for p in /om /demo /eksempelrapport /faq /kontakt /personvern /vilkar /kundereisen; do
  PAGE="$($CURL "$A$p")"
  check "deling $p: og:image absolutt + 1200×630 + alt + site_name" "1|1|1|1|1" \
    "$(printf '%s' "$PAGE" | grep -c "<meta property=\"og:image\" content=\"http://127.0.0.1:$PORT_A/og-bilde.png?v=2\"")|$(printf '%s' "$PAGE" | grep -c 'og:image:width" content="1200"')|$(printf '%s' "$PAGE" | grep -c 'og:image:height" content="630"')|$(printf '%s' "$PAGE" | grep -c 'og:image:alt')|$(printf '%s' "$PAGE" | grep -c 'og:site_name')"
done
check "deling: /og-bilde.png?v=2 er PNG 1200×630" "200|image/png|1200x630" \
  "$(status "$A/og-bilde.png?v=2")|$(header content-type "$A/og-bilde.png?v=2")|$($CURL "$A/og-bilde.png?v=2" | head -c 24 | tail -c 8 | od -An -tu4 --endian=big | awk '{print $1"x"$2}')"
check "UU /demo: adressefeltet har label" "1" "$($CURL "$A/demo" | grep -c '<label for="adr"')"
check "UU /kundereisen: h1 og fokusstil" "1|1" "$($CURL "$A/kundereisen" | grep -c '<h1 class="sr-only"')|$($CURL "$A/kundereisen" | grep -c 'focus-visible')"
EKS="$($CURL "$A/eksempelrapport")"
check "eksempelrapport: indekserbar, ingen noindex, ingen sjekksum-påstand" "200|0|0" "$(status "$A/eksempelrapport")|$(printf '%s' "$EKS" | grep -c 'noindex')|$(printf '%s' "$EKS" | grep -c 'SHA-256')"
check "eksempelrapport: merket eksempeldata, ingen Byggforsk-nummer" "yes|0" "$([ "$(printf '%s' "$EKS" | grep -c 'Eksempeldata')" -ge 1 ] && echo yes || echo no)|$(printf '%s' "$EKS" | grep -Ec 'Byggforsk [0-9]')"
check "eksempelrapport: canonical på fast vert med ond Host" "$FALLBACK/eksempelrapport" "$($CURL -H "Host: $EVIL_HOST" "$A/eksempelrapport" | canonical)"
check "regel 6: /om og /faq uten pristall, «ubegrenset» og «per takstperson»" "0" "$( { $CURL "$A/om"; $CURL "$A/faq"; } | grep -ci '990\|ubegrens\|per takstperson')"
# Påstander uten målt baseline eller kode bak seg (docs/nettside-masterplan.md §1/§5.7).
# «Byggforsk-henvisninger» som leveranse: referansen når verken app, dokument eller
# delingsside ennå — bare sitatportens kontroll kan beskrives.
check "regel 6: salgsflatene uten ubelagte tids-/tall-/aksept-påstander" "0" \
  "$( for p in /om /demo /faq /eksempelrapport /kundereisen; do $CURL "$A$p"; done | grep -ci 'forsikringsklar\|forsikringsverdig\|på minutter\|2 t →\|datalag\|sju systemer\|to timer\|timevis\|fem åpne kilder\|hash-forseglet\|hash-sikret\|treningsdata\|in4mo\|2 sekunder\|byggforsk-henvisninger')"

# ── (ix) apiBase ≠ publicBase ───────────────────────────────────────────────
# S20-kjernen (signert medie-URL til AI-motoren bruker aldri rå Host, og følger
# API_BASE_URL) er flyttet til test/e2e-rapport-motor.sh: rapporttjenesten
# krever database for hovedbok og eierskapssjekk, og denne testen kjører uten.
# Her står bare det som ikke trenger DB: admin-base og canonical på B.
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
