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

## Charting a match

- **New match:** the opponent, who serves first, and the format are all you need; the rest can be
  filled in later from the match menu (••• → Match details).
- **One tap per point** on the first serve: Ace, Unreturned, or how the rally ended (Winner /
  Unforced error / Forced error, under the player who hit that shot).
- **Fault** on a first serve: the yellow 2ND SERVE banner appears. If the second serve goes in, just
  log how the point ended; if it misses, tap Double fault.
- **Unreturned vs Forced error:** the same moment seen from either side; the button decides who
  gets the credit. Tap **Unreturned** when the serve caused the miss (lunged, framed it, couldn't
  handle the pace): it counts for the server, next to aces. For a routine return he missed, tap the
  returner's **Unforced error** and tag it **Return**. Keep the returner's column otherwise for errors
  later in the rally.
- **Which shot?** (optional): the shot that ended the point, by the player whose button you tapped.
  Tag a missed return as **Return** so return-in-play % counts it; untagged, the app assumes the
  return went in and the error came later.
- **Undo** steps back one tap. Tap the last-point line, or **Points**, to change, delete or insert
  any point.
- The app saves after every tap and reopens the match if it's closed. ••• also has Suspend and End
  match early (retired / stopped).
- **Back up** from Settings after matches: everything lives only on the phone.

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

Tests live next to the code (`src/**/*.test.ts(x)`). The scoring engine and stats in `src/domain/`
are pure functions, so nearly everything is tested without a browser. Screen tests
(`src/ui/screens/*.test.tsx`) render the real screens with Testing Library in happy-dom, against an
in-memory IndexedDB.

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
src/ui/        React app: screens/, routes, settings, the in-memory match store
src/ui/DebugApp.tsx  Settings → Testing tools (engine debug screen, sample matches)
public/        app icons
```
