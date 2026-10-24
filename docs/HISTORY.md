# Tennis Tracker: project history and build record

*Last updated October 24, 2026, after Phase 5.*

I built Tennis Tracker to chart my son's junior tennis matches point by point from the stands. This
document records why I built it, what I set out to do, the decisions I made, and how it came
together, so that I, or anyone who picks it up later, can understand it and change it with
confidence.

- **Live app:** https://nkumar2632.github.io/tennis-tracker/
- **Repository:** https://github.com/nkumar2632/tennis-tracker
- **Related documents:** [SPEC.md](../SPEC.md) (my spec, the final word on what to build),
  [docs/PLAN.md](PLAN.md) (stack, data model and every decision, kept current),
  [README.md](../README.md) (how to use, run, test and deploy), [CLAUDE.md](../CLAUDE.md) (rules for
  AI-assisted changes).

This file is history. Where it and PLAN.md disagree about the *current* state, PLAN.md wins.

---

## 1. Why I built it

My son plays competitive junior singles: high school dual matches, USTA tournaments and UTR events.
I chart his matches on my iPhone, usually outdoors, often one-handed and often with no signal. I was
using an App Store app called "Tennis Tracker" (screenshots in [reference/](../reference/)), and it
fell short:

- Many stat rows were always empty or 0/0 (return stats, rally length, net points, drop shots)
  because the entry flow never collected that data.
- Point codes like "1:FOR" were ambiguous: a forced error committed *by* player 1, or forced *by*
  player 1?
- There was no view across matches, no match context (opponent rating, event, surface), and no
  useful report to send to his coach.

On **October 20, 2026** I created this repository with a written spec and screenshots of the old
app, and started building.

## 2. Goals

- **Fast, unambiguous point entry:** one tap for most points and never more than two; big,
  high-contrast buttons readable in sunlight; score and server always visible; undo one tap away;
  any past point editable; auto-save after every point; clean resume if the app closes.
- **Usable courtside:** a Progressive Web App installed to the iPhone home screen, fully offline,
  with data kept on the phone. No accounts and no backend, hosted on GitHub Pages.
- **Event-sourced data:** the point log is the single source of truth. Every score and stat is
  derived from it, so undo and edits just work and new stats apply to old matches.
- **Correct scoring:** best of 3 with a 7-point tiebreak, a 10-point match tiebreak instead of a third
  set, no-ad, and an 8-game pro set, with correct server rotation including tiebreaks.
- **Honest stats:** serve, return, rally, break points, pressure points, consolidation and break-back,
  and strokes when recorded, per match and per set for both players. **Never show a stat the entry
  flow doesn't collect.**
- **Across matches:** match list, win/loss record filtered by opponent UTR band, event type and
  surface, trend charts, and head-to-head.
- **Reports:** a 1-2 page PDF and an Excel export sent through the iPhone share sheet, plus full
  backup and restore.
- **Out of scope:** video, cloud sync, doubles, rally length and shot placement. I started with a
  single player and added support for several in Phase 5.

## 3. Approach and early decisions

I chose a Progressive Web App over a native iPhone app: it needs no App Store or developer account,
updates every time I publish a change, and works offline once installed. I used Claude Code to write
the code from my spec, one phase at a time, and tested each phase on my iPhone before moving on.
From the start I set up automatic deployment to GitHub Pages so every change could be tried on the
phone right away.

The main decisions I made before building:

| Topic | Decision |
|---|---|
| Missed returns | Logged as the returner's error, tagged **Return** (refined in Phase 2) |
| Matches that don't finish | End early as **retired** (counts in the record), **stopped** (doesn't count) or **suspended** (resume later) |
| Joining a match late | Optional starting score at setup |
| Editing | Any point can be changed or deleted, or a missed point inserted |
| Formats | 8-game pro set and the 10-point match tiebreak are what we usually play; presets plus fully adjustable options |
| Season | No fixed season; filter by date range |
| UTRs | Optional, and can be added after a match |
| Backup | JSON backup and restore early on, in Phase 2 |
| Screen sleep | Not needed; I turn off Auto-Lock while charting |
| 1st-serve-% chart per game | Keep it from the old app |

Every decision, including later ones, is recorded in the Decisions table in [PLAN.md](PLAN.md).

## 4. How the work was organized

- Work happened on a feature branch. Each phase ended with the typecheck, the full test suite, a
  production build, and browser checks at iPhone sizes, including the generated PDF and Excel files.
- I then tested the phase on my iPhone. When I was happy, the branch went in as a pull request; GitHub
  Actions re-ran the checks, the pull request was merged into `main`, and GitHub Pages deployed it.
- What I found while testing became the next round of changes and decisions.
- One-time setup: GitHub → Settings → Pages → Source → **GitHub Actions** (done in a browser; the
  GitHub app doesn't offer it).

## 5. Timeline

| Date (2026) | Step | Pull request |
|---|---|---|
| Oct 20 | Repository, spec and plan | |
| Oct 20 | **Phase 1:** scoring engine, stats, storage, debug screen, Pages deploy | [#1](https://github.com/nkumar2632/tennis-tracker/pull/1) |
| Oct 21 | **Phase 2:** match setup, point entry, resume, editing, backup and restore | [#2](https://github.com/nkumar2632/tennis-tracker/pull/2) |
| Oct 22 | **Phase 3:** match stats, timeline, PDF report, Excel export | [#3](https://github.com/nkumar2632/tennis-tracker/pull/3) |
| Oct 23 | **Phase 4:** season view with record, trends and head-to-head | [#4](https://github.com/nkumar2632/tennis-tracker/pull/4) |
| Oct 23 | **Phase 5:** several players | [#5](https://github.com/nkumar2632/tennis-tracker/pull/5) |

## 6. Phase by phase

### Phase 1: the engine

- The data model and scoring engine: all formats, deuce and no-ad, tiebreaks, match tiebreak, and
  server rotation across games, sets and tiebreaks.
- Replay of a match's point log into scores, with every point labeled (set, game, score, break point,
  pressure point), and every stat in the spec.
- On-device storage, a simple debug screen with random sample matches, the offline app shell, and the
  GitHub Pages deployment.
- Unit tests for every scoring rule and stat, plus property-based tests that play hundreds of random
  long matches and check that scores and servers stay consistent.

After trying it on my phone I asked for three changes, which went into the point-entry screen in
Phase 2:

- **Clear confirmation** each time a point is logged, so it's obvious the next tap starts a new point.
- **A simpler second serve:** after a fault, a 2ND SERVE banner shows; if the second serve goes in,
  just record how the point ended.
- **A clear stroke rule:** the stroke is the shot that ended the point, by the player whose button was
  tapped (the winner's shot for a winner, the missed shot for an error).

### Phase 2: charting a real match

- Home, settings, and match setup (only opponent, first server and format required; everything else
  optional and editable later; opponent autocomplete; late-start score).
- The point-entry screen: serve row, a two-column rally grid with my player on the left, an optional
  stroke row, undo, and the logged-point confirmation.
- A point list for editing, inserting and deleting points, with later points re-scored.
- Auto-save after every tap, reopening a live match on launch, ending early, suspending and resuming.
- JSON backup and restore.
- An update banner that only appears on Home and Settings, so an update can never interrupt a match.

**Unreturned serve vs. forced error:** these are the same moment seen from either side; the button
decides who gets the credit. **Unreturned** credits the server, next to aces. A routine missed return
is the returner's **Unforced error** tagged **Return**. I kept this explanation in the README and
added an **Unreturned serves** stat to Phase 3.

**UTR bands:** before Phase 3 I settled how opponents are grouped by rating: relative to my player's
own UTR at the time (Lower, Even within 0.5, Higher), with UTRs addable after a match because I won't
always know them courtside.

### Phase 3: reviewing and sending a match

- A match page with **Stats** (every collected stat by match or set, a stroke table when strokes were
  recorded, and the 1st-serve-% chart), **Timeline** (every point in plain language, tap to edit), and
  **Report**.
- The report compares the match with the season: other finished matches from the previous 12 months
  (practice excluded, at least 3 needed), using rates so short and long matches compare fairly, with
  the biggest differences highlighted.
- A PDF report (US Letter, key stats on page 1) and an Excel file (one sheet of points, one of stats),
  sent through the iPhone share sheet. Both work offline. The PDF uses a built-in font that covers
  Western European characters only, which keeps the app small.

### Phase 4: the season view

- A **Season** screen with shared filters: dates (quick ranges or chosen dates), event type, surface
  and opponent UTR band.
- **Record:** wins and losses, the record against each UTR band, and the match list with each
  opponent's UTR. Matches missing a UTR get an **Add UTR** button.
- **Trends:** one chart per key stat (1st serve %, 2nd-serve points won, double faults, unforced
  errors, winners minus unforced errors, pressure points won), one dot per finished match, with the
  average shown as a dashed line.
- **Head-to-head:** everyone played more than once, with the record and every match.

### Phase 5: several players

I added support for tracking two or three players:

- Each match belongs to a player. Home shows one player at a time, with a button per player once
  there are two or more; with one player the app looks the same as before.
- New matches default to the player shown on Home and fill in that player's latest UTR. A match can
  be moved to another player, and players are added, renamed and deleted in Settings.
- Season stats, report comparisons and UTR fallbacks only ever use one player's matches. Opponent
  names are shared, since siblings often face the same people.

Existing data upgrades automatically: everything charted before Phase 5 becomes one player, named from
the old name setting. Before release, the upgrade was tested by loading the previous version with
real-sized data, including a match in progress, and switching to the new version. All matches and
points carried over, and the live match reopened where it left off. Older backup files still restore.

A small fix followed on October 24: clearing a player's name right after renaming them could briefly
restore the previous name.

## 7. Practical notes

- **Where the data lives:** only on the phone, in the home-screen app's storage. GitHub hosts the
  app's code, never match data. Nothing leaves the phone except files I choose to share.
- **How long it's kept:** indefinitely while the app stays installed. Deleting the home-screen icon
  deletes the data, so I back up regularly (Settings → Back up; save to Files, iCloud Drive, a NAS
  share or email).
- **Sharing the app:** anyone can install it from the same link. Each phone gets its own separate,
  empty copy, and updates reach everyone.
- **Hosting:** GitHub Pages provides HTTPS (required for offline use), works anywhere and needs no
  upkeep. Hosting on a home NAS wouldn't move the data off the phone, and changing the address would
  mean moving data by backup and restore. The NAS is better used as a place to keep backups (iPhone
  Files app → Connect to Server).
- **Public repository:** on GitHub's free plan, Pages publishes from public repositories. The code is
  visible; match data never is. The website is open to anyone with the link.

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

Real match data lives on phones, so formats only ever move forward, with an upgrade path.

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
- Don't add features beyond SPEC.md and PLAN.md without checking with me first.
- Every rule in `src/domain/` gets a unit test.
- Never edit an existing database version.
- Keep the README current.
- Work in phases, and stop so changes can be tested on a phone.

**Releasing:** work on a branch, open a pull request (CI runs the typecheck, tests and build), merge
to `main`, and GitHub Actions deploys. Phones pick it up the next time the app opens, or via the
Reload banner on Home or Settings. The installed version number is at the bottom of Home.

**Common changes:**

- *A new stat:* compute it in `stats.ts` from what the log already holds, add it to `statRows.ts` (and
  the PDF or Excel if wanted), and add tests. If it needs data the entry screen doesn't collect, the
  entry flow has to change first.
- *A new match detail field:* add it to `Match` in `types.ts` as optional (old matches won't have
  it), to the setup form in `screens/Setup.tsx`, and to the backup checks if it must be valid. A
  database version is needed only if it must be indexed or old data must be rewritten.
- *A schema change:* add `db.version(N)` with an `.upgrade()` in `src/storage/db.ts`, bump the match
  or backup version if their shape changes (keeping the old one restorable), and copy the "upgrade
  from one player" tests in `src/storage/repo.test.ts`. Before release, load the live version with
  data in a browser, then switch to the new build on the same address and confirm nothing is lost.
- *A new screen:* add a route in `src/ui/routes.tsx` and a test next to the screen.

**Testing approach:** domain unit and property tests; storage tests against an in-memory IndexedDB;
screen tests that render the real routes in happy-dom; and manual browser checks at iPhone sizes. As
of Phase 5: 217 tests in 19 files.

## 10. Known limits and ideas not built

- **One phone per set of data.** No sync between devices, and restore replaces everything rather than
  merging. Automatic sync (for example to a home NAS) would need a server and is a separate project.
- **PDF characters:** the built-in font prints Western European characters only.
- **Not yet tried:** Android (it should work by installing from Chrome).
- **Not built on purpose:** keeping the screen awake (I turn off Auto-Lock), and anything the entry
  flow doesn't collect: rally length, net points, shot placement, video, doubles.
- **Opponents are names, not records.** Head-to-head matches names ignoring case and spacing, so a
  misspelled name counts as a different opponent.
