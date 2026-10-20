# Tennis Tracker

Point-by-point match charting for junior singles, built as an offline-first Progressive Web App
for iPhone. All data stays on the phone (IndexedDB); there are no accounts and no backend.

- Product spec: [SPEC.md](SPEC.md)
- Approved plan, decisions and phase status: [docs/PLAN.md](docs/PLAN.md)
- Screenshots of the app being replaced: [reference/](reference/)

## Install on your iPhone

1. Open **https://nkumar2632.github.io/tennis-tracker/** in Safari.
2. Tap Share → **Add to Home Screen**.
3. Always open the app from the home-screen icon. On iOS the home-screen app keeps its own data,
   separate from Safari, so matches charted in a Safari tab won't show up in the app.

When a new version is deployed, the app shows **"A new version is ready — Reload"**. It never
reloads by itself, so an update can't interrupt a match. Closing and reopening the app also
picks up the new version.

## Run locally

Requires Node 22.12 or newer.

```sh
npm install
npm run dev               # http://localhost:5173
npm run dev -- --host     # also reachable from a phone on the same Wi-Fi
```

Offline support only runs in a production build: `npm run build && npm run preview`.

## Test

```sh
npm test            # unit tests + property-based tests (Vitest + fast-check)
npm run typecheck   # TypeScript
npm run check       # both
```

Tests live next to the code (`src/**/*.test.ts`). The scoring engine and stats in `src/domain/`
are pure functions, so nearly everything is tested without a browser.

## Deploy

Every push to `main` runs the typecheck and tests, builds the app, and deploys it to GitHub
Pages ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Pull requests run the same
checks without deploying. A failing test blocks the deploy.

One-time setup: in the GitHub repo go to **Settings → Pages → Build and deployment → Source** and
choose **GitHub Actions**.

You can also redeploy by hand from the **Actions** tab ("Test and deploy" → "Run workflow").

## Project layout

```
src/domain/    scoring engine, point log, stats: pure TypeScript, no browser APIs
src/storage/   IndexedDB (Dexie) database and save/load functions
src/ui/        React screens (Phase 1: a debug screen only)
public/        app icons
```
