# Agent Instructions — Knucklebomb

## Branch & Release Policy (R16)

1. **Single-branch workflow (`main` only)**:
   - All development, fixes, and content updates happen directly on `main`.
   - Do not create feature branches, staging branches, or release branches unless explicitly instructed by the user.
   - Always verify `node scripts/check.mjs` before committing to `main`.

2. **Publication Hold (`[skip ci]`)**:
   - While the studio-wide publication hold is active, every commit on `main` **must** include `[skip ci]` in the commit message so Netlify does not auto-publish builds until explicitly released.
   - Do not run `netlify deploy` or trigger production builds manually.

3. **Portal Analytics & Privacy (`G-7BQ8R81F1M`)**:
   - Keep `<meta name="poorcamp-analytics-id" content="G-7BQ8R81F1M">` and `<script defer data-portal-analytics src="/portal-analytics.js"></script>` intact in `index.html` and `portal-analytics.js`.
   - Never send player-typed text or query parameters to analytics.

4. **Mobile & Capacitor Packaging**:
   - `capacitor.config.json` targets `appId: "camp.poor.knucklebomb"` with `webDir: "."`.
   - Keep `viewport-fit=cover`, `apple-mobile-web-app-capable`, `manifest.webmanifest`, and safe-area inset CSS (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) intact.
