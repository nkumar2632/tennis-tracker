# Plan

The approved plan for building [SPEC.md](../SPEC.md), with the owner's decisions. SPEC.md wins if the
two ever disagree; update this file when a decision changes.

## Status

- [x] **Phase 1:** data model, scoring engine, stats, storage, tests, debug UI, deploy pipeline
- [x] **Phase 2:** match setup, point entry, resume, backup/restore
- [x] **Phase 3:** per-match stats, timeline, PDF report, Excel export
- [x] **Phase 4:** season view, trends, head-to-head
- [x] **Phase 5:** several players (added at the owner's request after Phase 4)

Stop at the end of each phase so the owner can test on their iPhone.

## Decisions

| Topic | Decision |
|---|---|
| Platform | PWA (not SwiftUI): offline, IndexedDB, installed to the home screen, hosted on GitHub Pages. |
| Missed returns (Unreturned vs Forced error) | They are the same moment seen from either side; the button decides who it's credited to. **Unreturned** (serve row) = the serve caused the miss (he lunged, framed it, couldn't handle the pace): one tap, credited to the server next to aces, and always counts as a return not in play. A routine return he missed = the returner's **Unforced error** tagged **Return**. Otherwise the returner's column is for rally errors, so "forced errors" means rally shots. A returner's error without the Return tag counts as a return that went in (the error is assumed to come later in the rally). Score, serve/return points won, break points and pressure points come out the same either way. |
| Unreturned serves stat | Shown in the Phase 3 serve stats next to aces, for both players (collected by the Unreturned button). |
| Matches that don't finish | "End match early" with a reason: **retired** (counts in win/loss), **stopped** (e.g. dual already decided; excluded from win/loss, stats still count), or **suspended** (resumable later). |
| Late start | Setup takes an optional starting score (finished sets, current games, who serves next). Charting starts at the beginning of a game. Stats cover charted points only. |
| Editing | Any past point can be changed, deleted, or a missed point inserted. Later points are re-scored and their servers re-derived. |
| Formats | Presets: best of 3 (7-pt tiebreak at 6-6), 2 sets + 10-pt match tiebreak, 8-game pro set (7-pt tiebreak at 8-8), and **Fast4** (as UTR events play it): best of 3 sets to 4 games, 5-pt tiebreak at 3-3 decided by one point at 4-4, no-ad, and a 10-pt match tiebreak (win by 2) instead of a third set. Some events use a 7-point tiebreak or a full third set; both are adjustable. No-ad is a separate toggle (Fast4 turns it on). Games per set, tiebreak score, tiebreak points, the tiebreak deciding point and match tiebreak points are all adjustable. |
| Fast4 tiebreak serve (added after Phase 5) | The usual tiebreak rotation (first server 1 point, then 2 each). The deciding point at 4-4 is served by the player who received first, as in Tennis Australia club rules; some events spin a racquet for it instead. The player who received first serves the next set. |
| Season | No fixed season: filter by date range. Practice matches are excluded from the record and season averages by default (toggle). |
| UTR | Opponent UTR, handedness and the player's UTR are optional, and can be added or changed any time, including after the match (match page → Edit match details). New matches prefill the player's UTR from their own latest match and an opponent's from past matches against them (any player's). |
| UTR band filter (Phase 4) | Relative to the player's rating at the time: opponent's UTR minus theirs. Bands: **Lower** (more than 0.5 below), **Even** (within 0.5), **Higher** (more than 0.5 above). If the player's UTR is blank for a match, use their UTR from their nearest-dated match that has one. If the opponent's UTR is blank, or the player's UTR isn't recorded on any of their matches, the match goes in **Unknown**; that group lists the matches so a UTR can be added with one tap. |
| Backup | JSON backup/restore moved up to Phase 2. Restore replaces all data (every player) after a confirmation. Backups made before Phase 5 restore into one player named from the old name setting. |
| Screen sleep | Not built; the owner turns off Auto-Lock when charting. |
| 1st serve % per game chart | Keep it (Phase 3), per service game, both players. |
| Layout | The player being charted is always on the left and listed first; light high-contrast theme. |
| Logged-point feedback (Phase 1 testing) | Every tap that logs a point shows "✓ Point N · Sam: forehand winner" (flashes), the score pops, and the tapped button flashes. Undo shows what it undid. The stroke question sits in its own fixed row so nothing moves between taps. |
| Second serve (Phase 1 testing) | After Fault, a yellow "2ND SERVE" banner shows and Fault becomes Double fault. A second serve that goes in needs no extra tap: just log how the point ended. |
| Which stroke (Phase 1 testing) | The shot that ended the point, by the player whose button was tapped: the winner's shot for a winner, the missed shot for an error (even though the other player won the point). The question names the player and ending, e.g. "Lee's unforced error: which shot?". |
| Testing tools | The Phase 1 debug screen stays under Settings → Testing tools (sample matches for trying the app). |
| Surfaces | Hard, clay, grass; indoor/outdoor is separate. |
| Season view | Trends show the player only; per-match stats show both players. |
| PDF | US Letter, single column; key stats on page 1. Uses the built-in Helvetica font (no 850 kB download), which prints Western European characters only (é, ü, ñ are fine; other scripts show as "?"). |
| Season comparison (Phase 3) | Baseline: other finished matches (completed, retired or stopped) with charted points, in the 12 months up to the match date, practice excluded. Needs at least 3. Every compared stat is a rate, so short and long matches compare fairly: aces and double faults as % of service points, winners and unforced errors as % of points played. A rate needs at least 5 chances in both the match and the season. The 3 biggest differences each way (at least 3 percentage points) are highlighted as "better/worse than usual". |
| Excel (Phase 3) | Two sheets: **Points** (one row per point: set, game, server, serve, score before, how it ended, by whom, stroke, who won it, games and points after, break/pressure point) and **Stats** (match and each set side by side, plus strokes and notes). |
| Players (Phase 5) | Any number of players (built for 2-3). Every match belongs to one player; opponents are just names, shared across players for autocomplete and UTR prefill. Home shows one player at a time, switched with buttons at the top once there are two or more (with one player the app looks as before). Season, the Report's season comparison and the UTR fallback only ever use that player's matches. New match defaults to the player on Home and can be changed; starting a match (or reopening a live one on launch) switches Home to its player. Match details can move a match to another player. Settings → Players adds, renames and deletes players; deleting a player deletes their matches after a confirmation. Existing data (database version 1) becomes one player named from the old name setting, or "Player" if none was saved. |
| Season screen (Phase 4) | Home → Season, with three tabs (Record, Trends, Head-to-head) under one set of filters: dates (last 12/6/3 months, since January 1, all dates, or chosen dates; default last 12 months), events (default all but practice), surface, opponent UTR band. Filters stay set while the app is open. |
| Record (Phase 4) | Wins and losses count completed and retired matches; stopped and unfinished ones are listed but not counted. Shows the record for the filters, the record in each UTR band (same filters, every band), and the match list with each opponent's UTR and band. Matches in Unknown have an **Add UTR** button that opens match details. |
| Trends (Phase 4) | One chart per stat, the player's values only: each finished match with charted points is a dot, oldest to newest, evenly spaced; a dashed line is their average over the same matches, computed like the season comparison (percentages pooled over points, counts per match). A match with nothing to measure (e.g. no pressure points) is left out of that chart. Tap a match's column to see its value and open it. |
| Head-to-head (Phase 4) | Opponents the player played more than once within the filters (names matched ignoring case and spacing), most matches first, with the record and every match. |
| Timeline (Phase 3) | Chronological on the match page; the live Points list (from point entry) is the same view, newest first. Score after each point is server first; games scores are the player first. |

## Tech stack

| Area | Choice |
|---|---|
| Language/build | TypeScript, Vite |
| UI | React 19, plain CSS |
| Routing (Phase 2) | wouter with hash URLs (GitHub Pages has no SPA fallback) |
| Offline | vite-plugin-pwa (Workbox), `registerType: 'prompt'` so a deploy never reloads mid-match |
| Storage | Dexie 4 over IndexedDB; `navigator.storage.persist()` |
| PDF (Phase 3) | pdfmake, lazy-loaded; the report is a plain document definition, so its content is unit-testable |
| Excel (Phase 3) | write-excel-file, lazy-loaded |
| Charts | Hand-written SVG |
| Tests | Vitest, fast-check (property tests), fake-indexeddb |
| CI/CD | GitHub Actions → GitHub Pages on every push to `main` |

## Data model

See `src/domain/types.ts`. A `Player` is an id, a name and when it was added. A `Match` holds its
player (`playerId`), its setup, its format, who served first, an optional starting score, and
**the point log**. Each `Point` stores server, serve number (1/2), ending, who
ended it, optional stroke, and a timestamp (stored, not shown). A pending first-serve fault is saved
on the match so resume is exact.

Everything else is derived:

- `replay(match)` (`replay.ts`) runs the log through the scoring engine (`scoring.ts`) and labels
  every point with set, game, score before/after, tiebreak, break point and pressure point.
- `computeStats(replay, { setNumber? })` (`stats.ts`) gives every stat in the spec for both players.
- `aggregateStats(stats[])` gives season averages: percentages pooled over all points, counts per match.
- Log operations (`log.ts`): append, fault, undo, set stroke, edit, insert, delete, end early,
  suspend, resume. Each re-derives servers and rejects edits that would leave points after match point.

### Definitions

- **Point winner:** ace, unreturned serve, winner → the player who ended it; double fault, forced
  error, unforced error → the other player. Errors always belong to the player who missed.
- **Break point:** the receiver wins the (non-tiebreak) game by winning the point, including the
  no-ad deciding point.
- **Pressure point:** break points, 30-30, deuce, either advantage, the no-ad deciding point, and
  every tiebreak and match-tiebreak point.
- **Hold % / break %:** finished regular games only (tiebreaks excluded).
- **2nd-serve points:** double faults count as points lost by the server (and won by the returner).
- **Return in play:** of serves in (not double faults), those that weren't an ace, an unreturned
  serve, or a receiver error tagged with the Return stroke.
- **Consolidation:** the breaker holds in the very next game, including across a set boundary; not
  counted when the next game is a match tiebreak. **Break-back:** the broken player breaks in the
  very next game. A chance belongs to the set where the break happened.
- **Server rotation:** alternates every game across sets; in tiebreaks the first server serves one
  point, then two each; the player who received first in a tiebreak serves the next game.

## Screens (Phases 2-4)

1. Home: player switch (two or more players), resume, new match, matches/season, settings. Reopens a live match on launch.
2. Match setup: opponent, format and first server required; everything else optional and editable
   later; remembers the last event/surface/format; opponent names autocomplete.
3. Point entry: serve row (Ace | Unreturned | Fault/Double fault), rally grid (son left, opponent
   right: Winner / Unforced error / Forced error), optional stroke strip in its own row, Undo, point list.
4. Edit point sheet.
5. Match detail: Stats (Match / Set tabs), Timeline (plain language), Report (share PDF/Excel).
6. Season: match list, record with filters, trends, head-to-head.
7. Settings: players, backup, restore.

## Phases

**Phase 1 (done):** project setup and offline shell; scoring engine (all formats, no-ad, tiebreaks,
match tiebreak, rotation); replay; every stat; season aggregation; Dexie schema v1; unit and property
tests; debug UI; GitHub Pages deploy workflow; CLAUDE.md; README; this plan.

**Phase 2 (done):** home, settings (son's name), match setup (with late start), point entry with stroke
strip, undo, point list with edit/insert/delete, auto-save, resume, end early/suspend, JSON
backup/restore. UI tests (Testing Library + happy-dom) cover point entry, setup and the point editor.

**Phase 3 (done):** match page with Stats (Match/Set tabs; all collected stats including unreturned
serves; stroke table when strokes were recorded; 1st-serve-% chart by service game), Timeline (plain
language, tap to edit), and Report (season comparison on screen; PDF and Excel built when the tab
opens and shared through the share sheet, or downloaded where sharing files isn't supported).

**Phase 4 (done):** Season screen from Home: match list (result, opponent, opponent UTR and band,
Add UTR for unknown), win/loss record with filters (UTR band, event type, surface, date range) and
by UTR band, trend charts (1st serve %, 2nd serve points won, DFs, UEs, W−UE, pressure-point %),
head-to-head. Logic in `src/domain/seasonView.ts`; screen tests in `src/ui/screens/Season.test.tsx`.

**Phase 5 (done):** several players: `Player` records and `Match.playerId` (Dexie version 2 with an
upgrade that gives existing matches to one player), backup version 2 with players (version 1 still
restores), Home player switch, player choice on New match and Match details, Settings → Players,
and per-player season, report baseline and UTR prefill. Logic in `src/domain/players.ts`; screen
tests in `src/ui/screens/Players.test.tsx`; upgrade tests in `src/storage/repo.test.ts`.

## iOS notes

- Home-screen app storage is separate from Safari; always chart from the icon.
- Home-screen apps are exempt from Safari's 7-day storage purge; the app also requests persistent
  storage. The JSON backup is the real safety net.
- The share sheet must be opened directly by a tap, so report files are generated before the Share
  button is pressed.
- No vibration API on iOS web: every tap needs clear visual feedback.
- All of the owner's GitHub Pages sites share one origin, so the database has a specific name.
