# Render Setup — Cloud Persistence for Inspection Projects

The backend (`apps/api`) now persists projects, notes, reports, and media on the server.
This guide covers the one-time Render setup needed to enable it in production.

Until this setup is done, the backend responds with `503 { "error": "Persistence not configured. …" }`
on the `/api/projects` routes and the app quietly falls back to device-only storage
(the sync pill shows «Lagret på enheten», `sync.disabled` in `apps/mobile/src/i18n/nb.ts`).

## 1. Create a Postgres database

1. In the Render dashboard: **New → PostgreSQL**.
2. Pick the same region as the `janitorai-backend` web service.
3. The free/starter plan is fine for a demo; upgrade later if needed.
4. After it's created, copy the **Internal Database URL** (preferred when the
   database and web service are in the same region; otherwise use the External URL).

No manual schema setup is needed — the API creates all its tables automatically on boot
(`SCHEMA_SQL` in `src/db.js`: projects, media, tester_tokens, shares, report_generations,
cost_events, logs, sidevisninger, pilot_interesse, …; idempotent `CREATE TABLE IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS`).

## 2. Add a persistent disk for media files

Uploaded photos and voice recordings are stored on disk (not in Postgres).
Render's default filesystem is ephemeral — files vanish on every deploy — so attach a disk:

1. Open the `janitorai-backend` web service → **Disks** → **Add Disk**.
2. Name: `media`, Mount Path: `/var/data`, Size: 1 GB is plenty to start.
3. Note: adding a disk requires a paid instance type on Render.

If you skip the disk, media uploads still work but files are lost on each deploy
(project text/notes/reports remain safe in Postgres).

## 3. Set environment variables on the web service

On `janitorai-backend` → **Environment**:

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | the URL copied in step 1 | required to enable cloud sync |
| `MEDIA_DIR` | `/var/data/media` | must live on the mounted disk |
| `DATABASE_SSL` | `true` | only needed when using the **External** database URL; internal URLs and URLs containing `render.com`/`sslmode=require` enable SSL automatically |
| `TESTER_TOKEN` | `openssl rand -hex 24` | Standard-tilgangskode: seedes som aktivt token ved boot (`db.js`) og er eneste gyldige token uten database. Flere testere: `POST /api/admin/tester-tokens`. |
| `FROST_CLIENT_ID` | fra frost.met.no | Historisk vær i saksunderlaget (`/api/underlag/vaer`). Usatt → `{configured:false}` og værraden skjules i appen; demoen bruker locationforecast uten nøkkel. |
| `NODE_ENV` | `production` | **Sett den.** Krever `https://` i `PUBLIC_BASE_URL`/`API_BASE_URL`, tar loopback ut av vert-allowlista, generiske feilsvar (S17). |
| `PUBLIC_BASE_URL` | `https://janitorai-backend.onrender.com` | Absolutt base for canonical/og:url/sitemap/robots/security.txt (`src/publicBase.js`). Bytt til `https://docrai.io` **først når DNS peker hit**. Valideres ved oppstart: kun `https://vert[:port]` i produksjon (`http://` godtas bare utenfor), små bokstaver, ingen sti/`/`. Ugyldig → feillogg + fallback til onrender-verten. Usatt → allowlistet vert fra `Host`, ellers samme fallback. Rå `Host` brukes aldri (S20). |
| `API_BASE_URL` | (usatt) eller `https://janitorai-backend.onrender.com` | Verten AI-motoren henter media fra (signerte `/api/media/<id>?exp=&sig=`) og basen admin-dashbordet bruker. **To-tjeneste-kontrakt: må stå likt på `janitorai-backend` OG `ai-engine`, eller usatt på begge.** Ulik verdi → alle rapporter feiler i motoren (`URL host … does not match configured API host`, `server.py`/`main.py`). Satt bare på API-et: fungerer, men motoren sjekker da ikke vert. Satt bare på motoren: klienter på en annen vert får alle rapporter avvist. Små bokstaver, ingen port, ingen `/` (motoren sammenligner netloc eksakt). Ved DNS-bytte: oppdater begge samtidig. Sett den også på preview-/staging-tjenester: på en ukjent vert faller admin-dashbordet ellers tilbake til produksjons-API-et. |
| `SECURITY_CONTACT` | `mailto:…` eller `https://…` | Publiserer `/.well-known/security.txt` (RFC 9116). Usatt eller ugyldig → 404 (fail-closed). Bruk en rolleadresse, ikke en privat e-post. |
| `HSTS_MAX_AGE` | `300` → `86400` → `31536000` | `Strict-Transport-Security` kun bak TLS. Trapp: ett døgn på 300, en uke på 86400, deretter 31536000. Kun `max-age`; **aldri** `preload`/`includeSubDomains` (kan ikke angres). Usatt/0 → av. **Sjekk først** `curl -sI https://…/health \| grep -i strict-transport`: viser plattformen allerede en HSTS-header, la denne stå usatt — nettleseren bruker bare den *første* headeren (RFC 6797 §8.1), så trappa ville ikke virke. Sett den bare når svaret er tomt. |
| `MEDIA_URL_SECRET` | `openssl rand -hex 32` | HMAC-nøkkel for signerte medie-URL-er (S10). Usatt → efemer nøkkel per prosess (signaturer dør ved omstart). |
| `AI_ENGINE_URL` | `https://<ai-engine>.onrender.com` | Motorens adresse. Usatt → 503 «AI engine not configured» på rapport og eksport. |
| `AI_ENGINE_TOKEN` | = motorens `TESTER_TOKEN` | Tjeneste-til-tjeneste-hemmelighet i `x-tester-token` mot motoren. |
| `GEMINI_API_KEY` | fra Google AI Studio | Transkripsjon og bildebeskrivelse i API-et (S2: sendes i header). |
| `ADMIN_SECRET` | `openssl rand -hex 32` | `/api/admin/*` og admin-dashbordet (`x-admin-secret`). |
| `CORS_ORIGINS` | `https://docrai.io,https://…` | Lås API-et til webappens/admin-dashbordets origins (S12). Usatt → åpen (auth er header-token, ikke cookies). |
| `BOOKING_URL` | valgfri | Bookinglenke på `/kontakt`; usatt → e-post-fallback. |

Valgfrie tuning-variabler (dokumentert i koden): `HEAVY_RATE_LIMIT`, `GENERAL_RATE_LIMIT`,
`MEDIA_CLEANUP_GRACE_HOURS`, `MEDIA_SWEEP_DISABLED`, `MEDIA_DISK_WARN_PERCENT`,
`MEDIA_DISK_CRITICAL_PERCENT`, `RENDER_DATABASE_URL`, `STATIC_DIR`, `PORT`.
`OPENAI_API_KEY` leses ikke i koden (kun nevnt i eldre README/replit.md) og kan fjernes.

### Miljø på `ai-engine` (egen web-tjeneste)

| Variable | Notes |
| --- | --- |
| `API_BASE_URL` | Samme verdi som på `janitorai-backend`, eller usatt på begge (se over). |
| Google OAuth-token | **Påkrevd**, ellers starter ikke motoren (`google_api.py`): Secret File `/etc/secrets/token.json`, alternativt `TOKEN_JSON` (hele JSON-en som streng) eller `TOKEN_PATH`. Personlig OAuth-konto i pilotfasen (se personvern). |
| `TESTER_TOKEN` | = API-ets `AI_ENGINE_TOKEN`. |
| `GEMINI_API_KEY` | Analyse (Gemini). |
| `MASTER_ID`, `OUTPUT_FOLDER` (eller `FOLDER_ID`), `KNOWLEDGE_FOLDER` | Google Docs-mal, Drive-utmappe, kunnskapsmappe. |

Etter deploy, verifiser med curl (ikke med en skanner-score). Bruk **https** og
`Accept: text/html` der en nettleser ville gjort det — HSTS settes kun bak TLS,
og `security.txt` skal ikke skygges av webappen:

```bash
H=https://janitorai-backend.onrender.com
curl -sI "$H/om" | grep -iE 'strict-transport|x-robots'                 # HSTS ja (én header), X-Robots nei
curl -s  "$H/robots.txt" | tail -2                                        # Sitemap: $PUBLIC_BASE_URL/sitemap.xml
curl -s -H 'Accept: text/html' "$H/.well-known/security.txt" | head -1   # Contact: …, ikke <!DOCTYPE
curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: text/html' "$H/.well-known/x"  # 404, ikke 401 og ikke 200
curl -sI "$H/share/x" | grep -i x-robots                                  # noindex, nofollow
```

Also add `AI_ENGINE_URL` and `AI_ENGINE_TOKEN` here if they aren't already
set — without them every AI-dependent route (report generation, `/api/export`,
the admin Labs tab) returns 503. See "Render (AI-engine)" in
[`DEPLOYMENT.md`](DEPLOYMENT.md) for the second Render service this points
at, and note carefully: `AI_ENGINE_TOKEN` here is unrelated to this table's
own `TESTER_TOKEN` — it must instead match the *ai-engine* service's own
`TESTER_TOKEN` variable, which is a different service with a same-named env
var holding a different secret.

## 4. Redeploy and verify

1. Deploy the latest code (push to the connected branch or **Manual Deploy → Deploy latest commit**).
2. Smoke test (replace `$TOKEN` with the tester token):

```bash
# Should return {"projects":[],"deleted":[]} (not a 503)
curl -s -H "x-tester-token: $TOKEN" https://janitorai-backend.onrender.com/api/projects

# Upsert a test project
curl -s -X PUT -H "x-tester-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"project":{"id":"smoke-1","name":"Smoke test","inspectionDate":"2026-01-01","inspector":"Test","notes":[],"updatedAt":"2026-01-01T00:00:00.000Z"}}' \
  https://janitorai-backend.onrender.com/api/projects/smoke-1

# Clean up
curl -s -X DELETE -H "x-tester-token: $TOKEN" https://janitorai-backend.onrender.com/api/projects/smoke-1
```

3. In the app, the sync pill on the home screen should switch from
   «Lagret på enheten» to «Lagret i skyen» after the next sync
   (tap the pill to sync immediately). Strings live in `apps/mobile/src/i18n/nb.ts`.

## How sync behaves

- **Offline-first**: every change is saved to the device first, then pushed to the
  server about 2 seconds later. If the device is offline the pill shows
  «Venter på nett — lagret lokalt» and data is pushed on the next manual sync or
  the next time the app/project is opened with connectivity (no background retry).
- **Last-write-wins**: if two devices edit the same project, the most recent
  `updatedAt` wins (the server rejects older writes; the losing device picks up the
  newer copy on its next pull).
- **Deletes** propagate through tombstones, so a project deleted on one device
  disappears from others after their next sync.
- **Media**: photos/audio are uploaded once and referenced by ID; the web app loads
  media from the server, native devices prefer their local copy and fall back to the
  server copy.
