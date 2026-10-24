# Tennis Tracker

Point-by-point match charting for junior singles, built as an offline-first Progressive Web App
for iPhone. All data stays on the phone (IndexedDB); there are no accounts and no backend.

- Product spec: [SPEC.md](SPEC.md)
- Approved plan, decisions and phase status: [docs/PLAN.md](docs/PLAN.md)
- How the project started and was built, phase by phase: [docs/HISTORY.md](docs/HISTORY.md)
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
- **Formats:** best of 3, 2 sets + match tiebreak, 8-game pro set, and **Fast4** (UTR events: sets
  to 4 games, a 5-point tiebreak at 3-3 decided by one point at 4-4, no-ad). Everything can be
  adjusted under **Adjust**. In a Fast4 tiebreak the 4-4 point is served by the player who received
  first.
- **One tap per point** on the first serve: Ace, Unreturned, or how the rally ended (Winner /
  Unforced error / Forced error, under the player who hit that shot).
- **Fault** on a first serve: the yellow 2ND SERVE banner appears. If the second serve goes in, just
  log how the point ended; if it misses, tap Double fault.
- **Unreturned vs Forced error:** the same moment seen from either side; the button decides who
  gets the credit. Tap **Unreturned** when the serve caused the miss (lunged, framed it, couldn't
  handle the pace): it counts for the server, next to aces. For a routine return the player missed, tap the
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

## Several players

Add players in **Settings → Players** (rename them there too). With two or more, Home has a button
per player at the top: Home and Season show only that player's matches. **New match** is for the
player shown on Home (you can pick another at the top of the form), and starting a match switches
Home to that player. A match charted under the wrong player can be moved in ••• → Edit match
details. Deleting a player deletes their matches, after a confirmation.

Every report, season comparison and trend uses only that player's matches. Opponent names and UTRs
are shared, so an opponent one player has faced is suggested for the others.

## Reviewing and sending a match

Tap a match on Home. Its page has three tabs:

- **Stats:** every stat for both players, for the match or one set at a time, plus winners and
  unforced errors by stroke (when tagged) and a 1st-serve-% chart by service game.
- **Timeline:** every point in plain language with the score after it. Tap one to change it.
- **Report:** how this match compares with the player's season (the 12 months before it, practice
  excluded, once there are 3 other matches), and **Share PDF report / Share Excel file / Share
  both** to send them by Messages, Mail, AirDrop or Save to Files.

Add or fix details (UTRs, notes, event) any time from ••• → Edit match details.

## Season

Tap **Season** on Home (it shows the player chosen on Home). The filters at the top (dates, events, surface, opponent UTR) apply to all
three tabs and stay set while the app is open. By default: the last 12 months, practice left out.

- **Record:** wins and losses (stopped and unfinished matches are listed but not counted), the record
  against lower-rated, even and higher-rated opponents, and every match with the opponent's UTR.
  The band compares the opponent's UTR with the player's at the time (within 0.5 is even); if the
  player's UTR is blank on a match, their UTR from their nearest-dated match is used. Matches with a missing UTR show
  **Add UTR**.
- **Trends:** 1st serve %, points won on 2nd serve, double faults, unforced errors, winners minus
  unforced errors, and pressure points won, one dot per finished match, with the player's average as a dashed
  line. Tap a dot to see the match and open it.
- **Head-to-head:** everyone the player has played more than once, with the record and each match.

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
src/ui/        React app: screens/, match/ (match page tabs), season/ (season tabs), routes, store
src/ui/DebugApp.tsx  Settings → Testing tools (engine debug screen, sample matches)
public/        app icons
```
