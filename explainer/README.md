# DocrAI explainer site

Standalone, single-page marketing/explainer site for DocrAI. Plain HTML/CSS,
no build step, no backend — self-contained (fonts load from Google Fonts,
everything else is inline or a local asset in this folder).

Audience: Innovasjon Norge grant assessors and prospective insurance/damage-
restoration customers. Content is grounded in `docs/founders-playbook-docrai.md`
and `docs/produktdesign-aarsaksbildet.md` — no unvalidated metrics, no
customer/results claims.

Domain split (per the live setup): this site is meant for `docrai.io`; the
product itself lives at `app.docrai.io` (that's what the "Åpne DocrAI" button
links to).

## Deploying to Render (Static Site)

1. New → Static Site, point at this repo.
2. Root directory: `explainer`
3. Build command: (leave empty)
4. Publish directory: `explainer` (or `.` if root directory is already set to `explainer`)
5. Custom domain: `docrai.io`

No environment variables needed.

## Files

- `index.html` — the whole page
- `favicon.png`, `apple-touch-icon.png`, `og-bilde.png` — copied from
  `apps/api/src/assets/` (same brand assets used on the existing sales pages)
