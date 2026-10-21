# Plan

The approved plan for building [SPEC.md](../SPEC.md), with the owner's decisions. SPEC.md wins if the
two ever disagree; update this file when a decision changes.

## Status

- [x] **Phase 1:** data model, scoring engine, stats, storage, tests, debug UI, deploy pipeline
- [x] **Phase 2:** match setup, point entry, resume, backup/restore
- [ ] **Phase 3:** per-match stats, timeline, PDF report, Excel export
- [ ] **Phase 4:** season view, trends, head-to-head

Stop at the end of each phase so the owner can test on their iPhone.

## Decisions

| Topic | Decision |
|---|---|
| Platform | PWA (not SwiftUI): offline, IndexedDB, installed to the home screen, hosted on GitHub Pages. |
| Missed returns | Usually logged as a rally-grid error (unforced/forced) by the receiver. Return-in-play % counts an error as a missed return when it is tagged with the **Return** stroke, so the stroke strip lists Return first whenever the receiver made the error. "Unreturned serve" also counts as not in play. |
| Matches that don't finish | "End match early" with a reason: **retired** (counts in win/loss), **stopped** (e.g. dual already decided; excluded from win/loss, stats still count), or **suspended** (resumable later). |
| Late start | Setup takes an optional starting score (finished sets, current games, who serves next). Charting starts at the beginning of a game. Stats cover charted points only. |
| Editing | Any past point can be changed, deleted, or a missed point inserted. Later points are re-scored and their servers re-derived. |
| Formats | Presets: best of 3 (7-pt tiebreak at 6-6), 2 sets + 10-pt match tiebreak, 8-game pro set (7-pt tiebreak at 8-8). No-ad is a separate toggle. Games per set, tiebreak score, tiebreak points and match tiebreak points are all adjustable. |
| Season | No fixed season: filter by date range. Practice matches are excluded from the record and season averages by default (toggle). |
| UTR | Opponent UTR, handedness and the son's UTR are optional and can be filled in later. **Open:** confirm how the UTR band filter should work before Phase 4. |
| Backup | JSON backup/restore moved up to Phase 2. Restore replaces all data after a confirmation. |
| Screen sleep | Not built; the owner turns off Auto-Lock when charting. |
| 1st serve % per game chart | Keep it (Phase 3), per service game, both players. |
| Layout | Son always on the left and listed first; light high-contrast theme. |
| Logged-point feedback (Phase 1 testing) | Every tap that logs a point shows "✓ Point N · Sam: forehand winner" (flashes), the score pops, and the tapped button flashes. Undo shows what it undid. The stroke question sits in its own fixed row so nothing moves between taps. |
| Second serve (Phase 1 testing) | After Fault, a yellow "2ND SERVE" banner shows and Fault becomes Double fault. A second serve that goes in needs no extra tap: just log how the point ended. |
| Which stroke (Phase 1 testing) | The shot that ended the point, by the player whose button was tapped: the winner's shot for a winner, the missed shot for an error (even though the other player won the point). The question names the player and ending, e.g. "Lee's unforced error: which shot?". |
| Testing tools | The Phase 1 debug screen stays under Settings → Testing tools (sample matches for trying the app). |
| Surfaces | Hard, clay, grass; indoor/outdoor is separate. |
| Season view | Trends are son-only; per-match stats show both players. |
| PDF | US Letter, single column. |

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

See `src/domain/types.ts`. A `Match` holds its setup, its format, who served first, an optional
starting score, and **the point log**. Each `Point` stores server, serve number (1/2), ending, who
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

1. Home: resume, new match, matches/season, settings. Reopens a live match on launch.
2. Match setup: opponent, format and first server required; everything else optional and editable
   later; remembers the last event/surface/format; opponent names autocomplete.
3. Point entry: serve row (Ace | Unreturned | Fault/Double fault), rally grid (son left, opponent
   right: Winner / Unforced error / Forced error), optional stroke strip in its own row, Undo, point list.
4. Edit point sheet.
5. Match detail: Stats (Match / Set tabs), Timeline (plain language), Report (share PDF/Excel).
6. Season: match list, record with filters, trends, head-to-head.
7. Settings: son's name, backup, restore.

## Phases

**Phase 1 (done):** project setup and offline shell; scoring engine (all formats, no-ad, tiebreaks,
match tiebreak, rotation); replay; every stat; season aggregation; Dexie schema v1; unit and property
tests; debug UI; GitHub Pages deploy workflow; CLAUDE.md; README; this plan.

**Phase 2 (done):** home, settings (son's name), match setup (with late start), point entry with stroke
strip, undo, point list with edit/insert/delete, auto-save, resume, end early/suspend, JSON
backup/restore. UI tests (Testing Library + happy-dom) cover point entry, setup and the point editor.

**Phase 3:** match stats (Match/Set tabs; only collected stats; stroke tables only when recorded),
plain-language timeline, 1st-serve-% per game chart, PDF report (incl. match vs season averages with
the biggest differences highlighted, and notes), Excel export (points sheet + stats sheet), share
sheet. Check .xlsx sharing on iOS early.

**Phase 4:** match list (result, opponent, opponent UTR), win/loss record with filters (UTR band,
event type, surface, date range), trend charts (1st serve %, 2nd serve points won, DFs, UEs,
W−UE, pressure-point %), head-to-head.

## iOS notes

- Home-screen app storage is separate from Safari; always chart from the icon.
- Home-screen apps are exempt from Safari's 7-day storage purge; the app also requests persistent
  storage. The JSON backup is the real safety net.
- The share sheet must be opened directly by a tap, so report files are generated before the Share
  button is pressed.
- No vibration API on iOS web: every tap needs clear visual feedback.
- All of the owner's GitHub Pages sites share one origin, so the database has a specific name.
