I want to build a tennis match-charting app to track my son's competitive junior singles matches. I currently use an app called "Tennis Tracker." It's moderately useful but clunky, and I want a better version built for how we actually use it. Screenshots of the current app are attached.

## Who uses it and how
- Me (a parent), charting point-by-point live from the stands on an iPhone. Often outdoors, often one-handed, often with poor or no cell signal.
- After matches, I review stats and look at trends across his season, and I send a report to my son and his coach.
- My son is a high school sophomore (UTR ~7). Matches include high school dual matches, USTA tournaments, and UTR events. Singles only.

## Platform
Build a Progressive Web App installable to the iPhone home screen. It must work fully offline, with data stored on-device (IndexedDB). No accounts, no backend for now. I'll host it on GitHub Pages.
If you think native SwiftUI is clearly better for this use case, explain why before starting. Don't switch silently.

## What the current app does (see screenshots)
- Point-by-point logging: 1st/2nd serve, double fault, and point ending as winner / forced error / unforced error.
- Per-match overview with Match / Set tabs, a 1st-serve-% chart, a point-by-point timeline, resume match, saved matches.

## What's wrong with it
- Clunky entry, and many stat rows are always empty or 0/0 (return stats, rally length, net points, drop shots) because the entry flow never captures that data. Never show a stat we don't collect.
- Point codes like "1:FOR" are ambiguous: forced error committed BY player 1, or forced BY player 1?
- No view across matches, no match context (opponent rating, event, surface), and no useful report to send to a coach.

## Point entry (the most important screen)
Most points should take ONE tap; never more than two required.
Suggested layout (improve on it if you can):
- Serve row: Ace | Unreturned serve | Fault (becomes "Double fault" on 2nd serve).
- Rally grid, one column per player: Winner | Unforced error | Forced error. Tapping a cell records who ended the point and how; the point winner is derived (a winner by X = X wins; an error by X = the opponent wins).
- After a point logs, show an OPTIONAL stroke picker for the shot that ended it: Forehand, Backhand, Volley, Overhead, Drop shot, Return. It must never block; the next tap dismisses it.
- Big, high-contrast buttons readable in sunlight. Current score and server always visible. Undo always one tap away. Any past point can be edited.
- Auto-save after every point. Resume cleanly if the app closes or the phone dies mid-match.

## Data model
- Event-sourced: the point log is the single source of truth. Each point stores server, serve number, point-ending type, the player who ended it, and optional stroke. Scores and every stat are derived from the log, so undo/edit just work and new stats can be computed for old matches.
- Ending types are a fixed, clearly defined set: ace, unreturned serve, double fault, winner, forced error, unforced error. Errors are always attributed to the player who missed.
- Scoring engine supports: best of 3 with a 7-point tiebreak at 6-6; 10-point match tiebreak in place of a third set; no-ad scoring; 8-game pro set. Chosen at match setup. Correct server rotation, including within tiebreaks.
- Match setup: date, event name and type (HS dual / USTA / UTR / practice), round, surface, indoor/outdoor, opponent name, opponent UTR, opponent handedness, my son's UTR at the time, notes.

## Stats (per match and per set, for both players)
Everything below must be derivable from the point log, with no extra entry:
- Serve: 1st serve %, % points won on 1st serve, % won on 2nd serve, aces, double faults (total and on pressure points), hold %.
- Return: return-in-play %, % return points won vs 1st serve and vs 2nd serve, break %.
- Rally: winners, unforced errors, forced errors, winner-minus-UE differential.
- Break points: saved and converted.
- Pressure points (break points, 30-30, deuce/ad, tiebreak points): % won on pressure points vs all other points.
- Response: consolidation % (held serve the game after breaking) and break-back % (broke back the game after being broken).
- When stroke data was recorded: winners and unforced errors broken down by stroke.
- Point-by-point timeline.

## Season view (across matches)
- Match list with result, opponent, and opponent UTR.
- Win/loss record filterable by opponent UTR band, event type, and surface.
- Trend charts over time for the key stats: 1st serve %, 2nd serve points won, DFs, UEs, W-UE differential, pressure-point %.
- Head-to-head history against repeat opponents.

## Reports and export
- PDF match report (1-2 pages, clean and readable on a phone): score and match info, the key stats for both players, stroke breakdown if recorded, this match vs his season averages (highlight the biggest differences), and my notes.
- Excel export per match: one sheet with the point-by-point log, one with the stats.
- Send both through the iPhone share sheet (text, email, AirDrop).
- Full backup and restore of all data as JSON.

## Out of scope for now
Video, cloud sync, multiple users, doubles, rally length, shot placement. Don't add features I didn't ask for. I'd rather add later than prune.

## How to proceed
1. Start in plan mode. Review the screenshots, then propose the tech stack (including PDF and Excel libraries), data model, screen list, and a phased plan. List your questions. Wait for my approval.
2. Phase 1: data model + scoring engine + stat calculations, with thorough unit tests (deuce and no-ad, tiebreak server rotation, match tiebreak, undo across game and set boundaries, each derived stat). Only a minimal debug UI.
3. Phase 2: match setup, point-entry screen, resume.
4. Phase 3: per-match stats, timeline, PDF report, Excel export.
5. Phase 4: season view, trends, backup/restore.
Stop at the end of each phase so I can test on my phone before you continue. Keep a short README covering how to run, test, and deploy.
