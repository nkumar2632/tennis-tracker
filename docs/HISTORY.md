# Tennis Tracker: project history and build record

*Last updated October 24, 2026, after Phase 5.*

A record of why this app exists, what it was meant to do, the decisions made along the way, and how
it was built, phase by phase. It is meant for whoever changes the app next, whether that's the owner,
another developer, or a future Claude Code session.

- **Live app:** https://nkumar2632.github.io/tennis-tracker/
- **Repository:** https://github.com/nkumar2632/tennis-tracker
- **The other documents:** [SPEC.md](../SPEC.md) (the owner's spec, the final word on what to
  build), [docs/PLAN.md](PLAN.md) (stack, data model and every decision, kept current),
  [README.md](../README.md) (how to use, run, test and deploy), [CLAUDE.md](../CLAUDE.md) (rules for
  AI-assisted changes).

This file is history: it explains how things got the way they are. Where it and PLAN.md disagree
about the *current* state, PLAN.md wins.

---

## 1. How it started

The owner charts their son's competitive junior singles matches (high school sophomore, UTR about 7:
high school dual matches, USTA tournaments, UTR events) point by point from the stands on an iPhone.
They were using an App Store app called "Tennis Tracker" (screenshots in [reference/](../reference/))
and found it clunky:

- Many stat rows were always empty or 0/0 (return stats, rally length, net points, drop shots)
  because the entry flow never collected that data.
- Point codes like "1:FOR" were ambiguous: a forced error committed *by* player 1, or forced *by*
  player 1?
- There was no view across matches, no match context (opponent rating, event, surface), and no
  useful report to send to a coach.

On **October 20, 2026** the owner created this repository, added [SPEC.md](../SPEC.md) and the
screenshots, and asked Claude Code to propose a plan. All dates here are in the owner's time zone.

## 2. Goals (from SPEC.md)

- **Fast, unambiguous point entry:** one tap for most points and never more than two; big,
  high-contrast buttons readable in sunlight; score and server always visible; undo one tap away;
  any past point editable; auto-save after every point; clean resume if the app closes.
- **Usable courtside:** one-handed, outdoors, often with no signal. A Progressive Web App installed
  to the iPhone home screen, fully offline, with data on the phone (IndexedDB). No accounts and no
  backend, hosted on GitHub Pages.
- **Event-sourced data:** the point log is the single source of truth; every score and stat is
  derived from it, so undo and edits just work and new stats apply to old matches.
- **Correct scoring:** best of 3 with a 7-point tiebreak, a 10-point match tiebreak instead of a third
  set, no-ad, and an 8-game pro set, with correct server rotation including tiebreaks.
- **Honest stats:** serve, return, rally, break points, pressure points, consolidation and break-back,
  strokes when recorded, all per match and per set for both players. **Never show a stat the entry
  flow doesn't collect.**
- **Across matches:** match list, win/loss record filtered by opponent UTR band, event type and
  surface, trend charts, head-to-head.
- **Reports:** a 1-2 page PDF and an Excel export, sent through the iPhone share sheet; full JSON
  backup and restore.
- **Out of scope** (per the spec): video, cloud sync, doubles, rally length, shot placement, and
  anything not asked for. Multiple users was also out of scope at first; the owner later asked for
  several players (Phase 5).

## 3. Planning and the owner's first decisions

Claude Code reviewed the spec and screenshots and proposed a plan: a PWA rather than native SwiftUI
(the spec asked for one, and a PWA needs no App Store or developer account, deploys on every push and
works offline once installed), the libraries, the data model, the screens and the phases. Two extras
the owner asked for went into Phase 1: a GitHub Actions workflow that deploys to GitHub Pages on
every update to `main`, so each phase could be tested on the phone, and a short CLAUDE.md telling
future sessions to read SPEC.md first.

The owner answered ten open questions. In short:

| Question | Owner's answer | What was built |
|---|---|---|
| How are missed returns logged? | Usually as the returner's unforced or forced error | The returner's error tagged **Return**; later refined (see Phase 2) |
| Matches that don't finish | Agreed | End early as **retired** (counts), **stopped** (doesn't count) or **suspended** (resume later) |
| Joining a match late | Yes | Optional starting score at setup |
| Edit, insert and delete points | Both | Any point can be changed or deleted, or a missed one inserted |
| Formats | 8-game pro set with tiebreak at 8-8 and the 10-point match tiebreak are usual, but other options needed | Three presets, no-ad toggle, every number adjustable |
| What is a "season"? | Doesn't matter; a date range is fine | Date-range filters; no fixed season |
| UTR entry | Optional, can be left blank or added later | All UTRs optional and editable any time |
| Backup timing | Fine to do early | JSON backup and restore moved up to Phase 2 |
| Keep the screen awake | Not needed; the owner turns off Auto-Lock | Not built |
| 1st-serve-% chart per game (old app) | Keep it | Built in Phase 3 |

These and every later decision are recorded in the Decisions table in [PLAN.md](PLAN.md).

## 4. How the work was done

- Claude Code (on the web) did the building in a cloud session, on the branch
  `claude/app-replacement-tech-stack-y2iq03`.
- Each phase ended with: typecheck, the full test suite, a production build, and checks in a headless
  Chromium browser at iPhone sizes (Pro Max and SE), including inspecting the generated PDF and Excel
  files. Then a commit and push, and a stop so the owner could test on their iPhone.
- When the owner said "merge it", Claude opened a pull request, waited for CI, squash-merged it into
  `main`, and confirmed the GitHub Pages deploy. The branch was then reset to the new `main`.
- The owner tested each phase on the phone and sent feedback, which became decisions and changes.
- One-time setup by the owner: GitHub → Settings → Pages → Source → **GitHub Actions** (it has to be
  done in a browser; the GitHub app doesn't offer it).

## 5. Timeline

| Date (2026) | Step | Pull request |
|---|---|---|
| Oct 20 | Repository created; SPEC.md and screenshots added; plan proposed and approved | |
| Oct 20 | **Phase 1:** scoring engine, stats, storage, debug UI, Pages deploy | [#1](https://github.com/nkumar2632/tennis-tracker/pull/1) |
| Oct 21 | **Phase 2:** match setup, point entry, resume, editing, backup/restore | [#2](https://github.com/nkumar2632/tennis-tracker/pull/2) |
| Oct 22 | **Phase 3:** match stats, timeline, PDF report, Excel export | [#3](https://github.com/nkumar2632/tennis-tracker/pull/3) |
| Oct 23 | **Phase 4:** season view with record, trends and head-to-head | [#4](https://github.com/nkumar2632/tennis-tracker/pull/4) |
| Oct 23 | **Phase 5:** several players | [#5](https://github.com/nkumar2632/tennis-tracker/pull/5) |

## 6. Phase by phase

### Phase 1: the engine (Oct 20)

**Built:**

- The data model and the scoring engine: all formats, deuce and no-ad, tiebreaks, match tiebreak,
  and server rotation across games, sets and tiebreaks.
- `replay()`, which runs a match's point log through the engine and labels every point (set, game,
  score before and after, break point, pressure point).
- Every stat in the spec, per match and per set, plus season averages.
- IndexedDB storage (Dexie, database version 1).
- A minimal debug screen for charting and inspecting matches, plus random sample matches.
- The GitHub Pages workflow, the offline service worker, app icons, CLAUDE.md, README.md and PLAN.md.

**Testing:** unit tests for each rule (deuce and no-ad, tiebreak server rotation, match tiebreak,
undo across game and set boundaries, each derived stat), and property-based tests (fast-check) that
play hundreds of random long matches and check that scores and servers stay consistent. The property
tests were checked by planting rotation bugs on purpose and confirming the tests caught them.

**Owner's feedback from testing on the phone, and what changed:**

- *"Nothing shows me the last point was logged; it looks like I'm changing the previous one."* Every
  logged point now flashes "✓ Point N · Sam: forehand winner", the score pops, the tapped button
  flashes, and Undo says what it undid. The stroke question got its own fixed row so nothing moves
  between taps.
- *"After a first-serve fault, do I tap 'second serve in'?"* No: after Fault a yellow **2ND SERVE**
  banner shows and Fault becomes Double fault. If the second serve goes in, just log how the point
  ended.
- *"Is the stroke the winner's last shot or the loser's?"* It's the shot that ended the point, by the
  player whose button was tapped (the winner's shot for a winner, the missed shot for an error). The
  question now names the player, e.g. "Lee's unforced error: which shot?".

These went into the point-entry screen built in Phase 2.

### Phase 2: charting a real match (Oct 21)

**Built:**

- Home (resume, new match, match list) and Settings (the player's name).
- Match setup: only opponent, first server and format required; event, surface, UTRs and so on
  optional and editable later; remembers the last event, surface and format; opponent autocomplete;
  late-start score.
- The point-entry screen: serve row (Ace, Unreturned, Fault/Double fault), a two-column rally grid
  (Winner, Unforced error, Forced error, with the player on the left), the optional stroke row, Undo,
  and the logged-point feedback above.
- The point list with edit, insert and delete. Later points are re-scored and servers re-derived.
- Auto-save after every tap, reopening a live match on launch, end early, suspend and resume.
- JSON backup and restore (restore replaces everything after a confirmation).
- An update banner ("A new version is ready — Reload") that only shows on Home and Settings, so a
  deploy can never interrupt a match.
- Screen tests (Testing Library in happy-dom, against an in-memory IndexedDB).

**Issues found and fixed during the phase:** the player's name briefly flashed "Player" on load
(settings are now loaded once, before any screen shows); debug-screen styles leaked into the app;
the update check only ran on Home; the point editor kept a stroke that no longer applied after
changing who ended the point; the layout overflowed on an iPhone SE and with long names.

**Owner's question after testing:** *"How is 'serve unreturned' different from a forced error?"*
They are the same moment seen from either side; the button decides who gets the credit.
**Unreturned** credits the server (next to aces). A routine missed return is the returner's
**Unforced error** tagged **Return**. The owner said the explanation should stay, so it was added to
the README and PLAN.md, and an **Unreturned serves** stat was added to Phase 3.

**Before Phase 3** the owner asked for a roadmap of the remaining phases and chose how UTR bands work
(option 2 of the choices offered): bands relative to the player's own UTR at the time (Lower, Even
within 0.5, Higher), with the ability to add a UTR after a match, because they won't always know it
courtside.

### Phase 3: reviewing and sending a match (Oct 22)

**Built:**

- The match page with three tabs:
    - **Stats:** every collected stat for both players, by match or set, including unreturned
      serves; a winners and unforced errors by stroke table when strokes were recorded; the
      1st-serve-% chart per service game kept from the old app.
    - **Timeline:** every point in plain language with the score after it; tap one to edit it.
    - **Report:** this match against the player's season, then **Share PDF report / Share Excel
      file / Share both**.
- Season comparison rules: the baseline is other finished, charted matches in the 12 months before,
  practice excluded, at least 3 of them; every compared stat is a rate so short and long matches
  compare fairly; the 3 biggest differences each way (at least 3 percentage points) are highlighted.
- The PDF (pdfmake): US Letter, key stats on page 1, the built-in Helvetica font. That avoids an
  850 kB font download, but it only prints Western European characters.
- The Excel file (write-excel-file): a Points sheet (one row per point) and a Stats sheet.
- Both files are built when the Report tab opens, so the share sheet opens straight from the tap
  (iOS requires that), with a download fallback where sharing files isn't supported. Both libraries
  are cached for offline use, and making reports offline was tested.

**Technical notes:** pdfmake doesn't shade text backgrounds, so highlighted rows are one-cell tables.
Section headings could end up alone at the bottom of a page, so each section is kept together.

### Phase 4: the season view (Oct 23)

**Built:** Home → **Season**, with three tabs under shared filters:

- **Filters:** dates (last 12, 6 or 3 months, since January 1, all dates, or chosen dates), events
  (all but practice by default), surface, and opponent UTR band. They stay set while the app is open.
- **Record:** wins and losses (stopped and unfinished matches listed but not counted), the record
  against each UTR band, and the match list with each opponent's UTR and band. A match with a missing
  UTR has an **Add UTR** button.
- **Trends:** one chart per spec stat (1st serve %, 2nd-serve points won, double faults, unforced
  errors, winners minus unforced errors, pressure points won), one dot per finished match, with the
  average as a dashed line. Tap a dot to see the match.
- **Head-to-head:** everyone played more than once, with the record and every match.

**Choices made and reported to the owner:** the record-by-band table (slightly more than the spec's
"filterable by band"); head-to-head following the filters (choose "All dates" for full history); the
quick date ranges, because picking two dates on an iPhone date wheel is slow.

### Phase 5: several players (Oct 23)

**Requested by the owner** after Phase 4: track two or three players.

**Built:**

- A `Player` record per person and a player on every match.
- Home shows one player at a time, with a button per player at the top once there are two or more.
  With one player the app looks exactly as before.
- New match is for the player on Home (changeable on the form) and fills in that player's latest
  UTR. Starting a match, or reopening a live one, switches Home to its player.
- Match details can move a match to another player.
- Settings → **Players**: add, rename, delete. Deleting a player deletes their matches after a
  confirmation.
- Season, the report's season comparison and the UTR fallback only ever use one player's matches.
  Opponents are shared, since siblings often play the same people.
- Wording made player-neutral, e.g. UTR bands say "more than 0.5 below Sam".

**Upgrading existing data:** the database moved to version 2. The upgrade gives every existing
match to one player named from the old name setting. Before release this was tested in a real
browser: the live version was loaded with 15 matches, one of them mid-match, and then the new version
was served on the same address. All 15 matches and 1,629 points carried over, the live match
reopened with its score, and the settings were kept. Backups gained a version 2 format with players;
version 1 backups still restore.

**After Phase 5 (Oct 24):** a test that failed about one run in five was traced to a small real race
(clearing a player's name right after renaming could restore the previous name) and fixed.

## 7. Questions answered along the way

- **Where is the data?** Only on the phone, in the home-screen app's storage. GitHub only hosts the
  app's code. Nothing is sent anywhere except files the user shares.
- **How long is it kept?** Indefinitely while the app stays installed. Home-screen apps are exempt
  from Safari's 7-day storage limit, and the app asks for persistent storage. Deleting the icon
  deletes the data, so back up regularly (Settings → Back up; save to Files, iCloud Drive, a NAS
  share or email).
- **Can others use it?** Yes, from the same link; each phone gets its own separate, empty copy.
  Updates reach everyone.
- **GitHub or a home NAS?** Stay on GitHub Pages. It gives HTTPS (required for offline use) and works
  anywhere, with no upkeep. Hosting on a NAS would not move the data off the phone, and changing the
  address means starting empty and moving data by backup and restore. A NAS is useful as a place to
  save backups (iPhone Files app → Connect to Server).
- **Is the repository public?** Yes. On GitHub's free plan, Pages only publishes from public
  repositories. The code is visible; no match data ever is. The website is open to anyone with the
  link either way. The owner's email address appears on their own commits; they decided to leave it
  (GitHub → Settings → Emails → "Keep my email addresses private" hides it on future commits).

## 8. Build details

### Stack (versions as of Phase 5)

| Area | Choice |
|---|---|
| Language and build | TypeScript 7.0, Vite 8.3 |
| UI | React 19.3, plain CSS (light, high-contrast theme), hand-written SVG charts |
| Routing | wouter 3.13 with hash URLs (`#/match/...`), because GitHub Pages has no fallback for app routes |
| Offline | vite-plugin-pwa 2.0 (Workbox), `registerType: 'prompt'` so a deploy never reloads mid-match |
| Storage | Dexie 4.4 over IndexedDB, plus `navigator.storage.persist()` |
| PDF | pdfmake 0.3.12 with built-in Helvetica, lazy-loaded |
| Excel | write-excel-file 4.1, lazy-loaded |
| Tests | Vitest 5, fast-check 4 (property tests), fake-indexeddb 6, Testing Library 16 with happy-dom 21 |
| CI/CD | GitHub Actions: `npm ci`, typecheck, tests, build, then deploy to GitHub Pages (main only) |
| Node | 22.12 or newer |

### Architecture in one paragraph

A match is its setup plus **the point log** (`Match.points`). Nothing derived is ever stored. The
scoring engine (`src/domain/scoring.ts`) and `replay()` turn the log into scores; `computeStats()`
turns the replay into stats. Undo, edits, inserts and deletes are operations on the log
(`src/domain/log.ts`) that re-derive servers and refuse edits that would leave points after match
point. `src/domain/` is pure TypeScript with no browser APIs, so nearly everything is unit-tested
without a browser. The UI keeps the open match in memory and saves it after every tap
(`src/ui/store.ts`); lists read IndexedDB through live queries, so screens update by themselves.

### Where things are

| Path | What it holds |
|---|---|
| `src/domain/types.ts` | Player, Match, Point, formats, endings, strokes |
| `src/domain/scoring.ts`, `replay.ts`, `format.ts` | Scoring engine, replay, format presets and validation |
| `src/domain/log.ts`, `match.ts` | Point-log operations; creating and updating matches; outcomes |
| `src/domain/stats.ts`, `statRows.ts` | Every stat; how stats are grouped and labeled on screen |
| `src/domain/season.ts`, `report.ts`, `pdfDoc.ts`, `excel.ts` | Season comparison; report content; PDF and Excel layouts |
| `src/domain/seasonView.ts`, `players.ts`, `opponents.ts` | Season screen logic; players; opponent lookup |
| `src/domain/backup.ts` | Backup file format and checks before restoring |
| `src/domain/labels.ts`, `simulate.ts`, `test-helpers.ts` | Plain-language text; random sample matches; test match scripts |
| `src/storage/db.ts`, `repo.ts` | Database schema versions and upgrades; save and load functions |
| `src/ui/routes.tsx`, `App.tsx`, `hooks.ts`, `store.ts` | Routes, app shell, shared data hooks, the open-match store |
| `src/ui/screens/` | Home, Setup, Chart (point entry), Points, MatchScreen, Season, Settings |
| `src/ui/match/`, `src/ui/season/` | Match-page tabs; season tabs and filters |
| `src/ui/DebugApp.tsx` | Settings → Testing tools (debug screen and sample matches) |
| `.github/workflows/deploy.yml` | Test and deploy workflow |

**Screens (hash routes):** `/` Home · `/new` New match · `/settings` · `/debug` Testing tools ·
`/season`, `/season/trends`, `/season/h2h` · `/match/:id` (Stats), `/match/:id/timeline`,
`/match/:id/report` · `/match/:id/chart` point entry · `/match/:id/edit` Match details ·
`/match/:id/points` point list, plus point edit and insert routes.

### Data formats and their versions

Real match data lives on people's phones, so formats only ever move forward, with an upgrade path.

| Format | Version | Change |
|---|---|---|
| IndexedDB database (Dexie) | 1 (Phase 1) | `matches` and `settings` tables |
| | 2 (Phase 5) | adds `players` and a `playerId` index; the upgrade gives existing matches to one player |
| `Match.schemaVersion` | 1, then 2 (Phase 5) | 2 adds `playerId` |
| Backup file | 1, then 2 (Phase 5) | 2 adds the player list; version 1 files still restore |

## 9. Changing the app later

**Rules** (from [CLAUDE.md](../CLAUDE.md)):

- Never store derived scores or stats.
- Never show a stat the entry flow doesn't collect.
- Don't add features beyond SPEC.md and PLAN.md without asking.
- Every rule in `src/domain/` gets a unit test.
- Never edit an existing database version.
- Keep the README current.
- Work in phases and stop so the owner can test.

**Releasing:** work on a branch, open a pull request (CI runs the typecheck, tests and build), merge
to `main`, and GitHub Actions deploys. Phones pick it up the next time the app opens, or via the
Reload banner on Home or Settings. The live version number is at the bottom of Home.

**Common changes:**

- *A new stat:* compute it in `stats.ts` from what the log already holds, add it to `statRows.ts` (and
  the PDF or Excel if wanted), and add tests. If it needs data the entry screen doesn't collect, the
  entry flow has to change first, and that is the owner's decision.
- *A new match detail field:* add it to `Match` in `types.ts` as optional (old matches won't have
  it), to the setup form in `screens/Setup.tsx`, and to the backup checks if it must be valid. A
  database version is needed only if it must be indexed or old data must be rewritten.
- *A schema change:* add `db.version(N)` with an `.upgrade()` in `src/storage/db.ts`, bump the match
  or backup version if their shape changes (keeping the old one restorable), and copy the "upgrade
  from one player" tests in `src/storage/repo.test.ts`. Before release, repeat the real-browser
  upgrade check: load the live build with data, then serve the new build on the same address.
- *A new screen:* add a route in `src/ui/routes.tsx` and a test next to the screen.

**Testing approach:** domain unit and property tests; storage tests against an in-memory IndexedDB;
screen tests rendering the real routes in happy-dom. Browser checks at iPhone sizes were done with a
throwaway Playwright script outside the repository. As of Phase 5: 217 tests in 19 files.

## 10. Known limits and ideas not built

- **One phone per set of data.** No sync between devices. Restore replaces everything rather than
  merging. Automatic sync (for example to a home NAS) would need a server and is a separate project.
- **PDF characters:** Helvetica prints Western European characters only.
- **Untested on real devices from here:** the iPhone share sheet (it can only be exercised on a
  phone) and Android, which should work via Chrome's "Install app" but was never tried.
- **Not built on purpose:** keeping the screen awake (the owner disables Auto-Lock), and anything the
  entry flow doesn't collect: rally length, net points, shot placement, video, doubles.
- **Opponents are names, not records.** Head-to-head matches names ignoring case and spacing, so a
  misspelled name counts as a different opponent.
