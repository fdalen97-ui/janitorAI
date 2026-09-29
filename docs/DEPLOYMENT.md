# Deployment

This repository is now organized as an npm workspace monorepo:

- `apps/api`: Node/Express API
- `apps/mobile`: Expo Router mobile app
- `packages/shared`: Reserved for shared code between apps
- `docs`: Documentation

## Render (API)

Render should point at the API workspace directly.

- **Root directory**: `apps/api`
- **Build command**: `npm install`
- **Start command**: `npm start`
- **Environment variables**: unchanged (e.g., `PORT`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_TRANSCRIBE_MODEL`). Store them in Render as before or in `apps/api/.env` for local runs. Also requires `AI_ENGINE_URL` (`https://janitorai-ai-engine.onrender.com`) and `AI_ENGINE_TOKEN` (must equal `TESTER_TOKEN` on the ai-engine service — see "Render (AI-engine)" below) to reach the AI engine at all; without them, every AI-dependent route returns 503 `"AI engine not configured"`.
- **Node version**: `>=18.18.0` (from the API package).

The API still uses `node src/index.js` as its entrypoint and loads environment variables with `dotenv` from the workspace root.

## Render (AI-engine)

Render should point at the `ai-engine` workspace directly. This is a separate
service from the API — currently deployed as **`docrai-ai-engine`** at
`https://janitorai-ai-engine.onrender.com` (Frankfurt, `standard` plan).

- **Root directory**: `ai-engine`
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- **Environment variables**:
  - `TESTER_TOKEN` — shared secret checked on every protected route
    (`/api/report`, `/api/analyze`, `/api/prompt/blocks`, `/api/export/*`).
    **This must be the exact same value as `AI_ENGINE_TOKEN` on the API
    service** (see below) — the two env vars have different names on
    purpose (each service names it from its own point of view) but must
    hold one identical secret. Do not confuse this with the per-project
    `tester_token` in the API's Postgres schema (CLAUDE.md's tenant
    isolation) — that's a different, per-tenant concept; this one is a
    single engine-wide credential.
  - `GEMINI_API_KEY` — Gemini API key.
  - OAuth token for Drive/Docs access (`google_api.py`), first match wins:
    1. Render **Secret File** named `token.json` (preferred — mounted at
       `/etc/secrets/token.json`)
    2. `TOKEN_JSON` env var (full OAuth token JSON as a string)
    3. local `token.json` file, or `TOKEN_PATH` pointing at one (dev only)
  - `MASTER_ID` — Google Doc template id to copy per report.
  - `OUTPUT_FOLDER` (or its older alias `FOLDER_ID`) — Drive folder id
    reports are copied into.
  - `KNOWLEDGE_FOLDER` — optional; Drive folder id for the reference-PDF
    knowledge base. If unset, the knowledge-base prompt block is skipped
    rather than failing.
  - `API_BASE_URL` — optional SSRF guard; when set, the engine only accepts
    media URLs whose host matches it. Should be
    `https://janitorai-backend.onrender.com` in production.
- **Health check**: `/health` exists and is deliberately dependency-free (no
  Google/Gemini calls), so it reflects process liveness only. Render's
  **`healthCheckPath` is not currently configured** on this service — set it
  to `/health` in the dashboard (Settings → Health & Alerts) so Render can
  gate traffic during a deploy instead of routing to an instance that hasn't
  finished starting.

### Deploy ordering with the API

`docrai-ai-engine` and `docrai-backend` both watch the `main` branch and
auto-deploy on every push, but **Render does not sequence them** — one push
triggers two independent deploys. In practice they've finished close together
(the last merge to `main` had both `live` within about 90 seconds of each
other), but there's no guarantee. During that window, any `apps/api` route
that calls the engine (`/api/admin/labs/*`, `/api/export/*`, report
generation) can return a transient 502/503. This is expected and
self-resolving once both deploys finish — it is not a bug to chase, and no
manual "deploy the engine first" step is required or possible to enforce
from outside Render.

## EAS (Mobile)

EAS builds should target the mobile workspace.

- **Working directory**: `apps/mobile`
- **Install command**: `npm install`
- **Build commands**: run your existing `eas build` commands (e.g., `eas build --profile preview --platform ios`).
- **Environment variables**: `APP_ENV` (or `EAS_BUILD_PROFILE`) selects the build profile; optional `API_BASE_URL` override is read by `app.config.js`.

Expo Router continues to look for the `app/` directory inside `apps/mobile/app`, so no additional configuration is required after pointing EAS at the new workspace.

## Domener: docrai.io → salgssidene på Express

**Status 28.09.2026 (målt med `curl`):** `https://docrai.io/` serverer
`explainer/index.html` byte-identisk (Cloudflare Pages/Static Site, jf.
`explainer/README.md`), `https://docrai.io/om` svarer 404, og hele salgsflaten
(`/om`, `/demo`, `/eksempelrapport`, `/faq`, `/kontakt`, `/personvern`, `/vilkar`,
`/kundereisen`, `sitemap.xml`, `robots.txt`) finnes bare på
`https://janitorai-backend.onrender.com`. `https://app.docrai.io/` er webappen
(Expo-eksport). Beslutning (`docs/nettside-masterplan.md` §0 og §4): docrai.io
skal peke på Express-tjenesten, så det som er bygget faktisk er det som er live.

Rekkefølgen under er valgt så ingenting er brukket underveis: koden er allerede
klar for begge verter (`publicBase.js` allowlister `docrai.io` og
`www.docrai.io`; `LANDING_ROOT` gjør roten til salgssiden).

1. **Render — custom domain på `janitorai-backend`:** Settings → Custom Domains →
   legg til `docrai.io` og `www.docrai.io`. Render viser hvilken CNAME/ALIAS-verdi
   DNS skal peke på og utsteder TLS-sertifikat når DNS stemmer.
2. **Miljøvariabler på `janitorai-backend`** (alle beskrevet i `RENDER_SETUP.md`):
   - `LANDING_ROOT=/om` — ellers svarer `https://docrai.io/` med 401 JSON fra
     token-vakten, fordi denne tjenesten ikke har `STATIC_DIR`.
   - `PUBLIC_BASE_URL=https://docrai.io` — canonical, `og:url`, sitemap, robots og
     security.txt. Sett den **etter** at DNS peker hit (før det ville Google fått
     en canonical som 404-er).
   - `API_BASE_URL` — uendret (`https://janitorai-backend.onrender.com`) på både
     API og `ai-engine`, eller usatt på begge (to-tjeneste-kontrakten). Den
     styrer medie-URL-ene til motoren, ikke salgssidene, og trenger ikke bytte.
   - `CORS_ORIGINS` — legg til `https://docrai.io` om admin-dashbordet skal
     åpnes derfra; appen på `app.docrai.io` står der allerede.
   - `HSTS_MAX_AGE=300` — start trappa (ingen `strict-transport-security` sendes
     i dag). Ett døgn på 300, så 86400, så 31536000.
3. **Cloudflare DNS:** `docrai.io` → CNAME/flattened til Render-verten fra steg 1;
   `www` → CNAME til det samme. Behold proxy (oransje sky): Cloudflare
   brotli-komprimerer og cacher salgssidene i fem minutter fordi de nå sender
   `Cache-Control: public, max-age=300`. Legg en **Redirect Rule**
   `www.docrai.io/*` → `https://docrai.io/$1` (301), så det finnes én kanonisk vert.
4. **Cloudflare Pages/Static Site for `explainer/`:** fjern custom domain
   `docrai.io` fra det prosjektet (ellers vinner det DNS-oppslaget). Prosjektet
   kan beholdes uten domene, eller slettes; `explainer/` i repoet er ikke lenket
   fra noe etter byttet. Explainer laster Inter fra Google Fonts
   (`explainer/index.html:33-34`) — det er derfor personvernsidens «ingen
   tredjeparts sporing» ikke er sann for dagens forside. Express-sidene laster
   ingen eksterne ressurser.
5. **Verifiser** (fra en maskin utenfor Render):
   ```
   curl -sI https://docrai.io/            | grep -i '^location'        # 301 → /om
   curl -s  https://docrai.io/om          | grep -c fonts.googleapis   # 0
   curl -s  https://docrai.io/om          | grep -o '<link rel="canonical" href="[^"]*"'   # https://docrai.io/om
   curl -s  https://docrai.io/sitemap.xml | grep -c '<loc>'            # 8
   curl -sI https://docrai.io/om          | grep -i 'cache-control\|strict-transport\|x-powered'  # public, max-age=300; HSTS; ingen x-powered-by
   curl -sI https://app.docrai.io/        | head -1                    # 200 — appen uberørt
   ```
   Send deretter `sitemap.xml` på nytt i Search Console (om domenet er verifisert
   der; uverifisert i repoet).

**Webappen (`app.docrai.io`)** er en egen utrulling av Expo-eksporten og røres ikke
av byttet. Merk: `apps/mobile/app.json` setter `web.lang: "nb"`, men den utrullede
bundlen sender `<html lang="en">` (målt 28.09.2026) — neste web-eksport bør
kontrolleres med `curl -s https://app.docrai.io/ | grep -o '<html[^>]*>'`.

