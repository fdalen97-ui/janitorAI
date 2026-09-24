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
