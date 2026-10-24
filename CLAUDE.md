# CLAUDE.md

**Read [SPEC.md](SPEC.md) first.** It is the product spec and the final word on what to build.
Then read [docs/PLAN.md](docs/PLAN.md): the approved stack, data model, the owner's decisions on open
questions, and which phase is in progress. [docs/HISTORY.md](docs/HISTORY.md) explains how the
project got here and how to make common changes.

## Rules

- The point log (`Match.points`) is the single source of truth. Never store derived scores or stats;
  derive them with `replay()` and `computeStats()` in `src/domain/`.
- Never show a stat the entry flow doesn't collect.
- Don't add features beyond SPEC.md and docs/PLAN.md. Ask first.
- Work phase by phase and stop at the end of each phase so the owner can test on their iPhone.
- `src/domain/` is pure TypeScript with no browser APIs. Every rule there needs a unit test.
- Real match data lives on the owner's phone. Schema changes add a new Dexie version in
  `src/storage/db.ts` with an upgrade; never edit an existing version.
- Keep README.md current (run, test, deploy).

## Commands

```sh
npm install
npm run dev        # local dev server
npm test           # unit + property tests
npm run typecheck
npm run build
```

Pushing to `main` runs typecheck + tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).
