/** UI test helpers. Import 'fake-indexeddb/auto' before this module in each UI test file. */
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import type { Match } from '../domain/types';
import { db } from '../storage/db';
import { saveMatch, setSetting } from '../storage/repo';
import { Routes, useResumeOnLaunch } from './routes';
import { forgetAllMatches, whenSaved } from './store';

export async function resetData(playerName = 'Sam'): Promise<void> {
  await whenSaved();
  forgetAllMatches();
  await db.matches.clear();
  await db.settings.clear();
  if (playerName) await setSetting(db, 'playerName', playerName);
}

export async function seed(...matches: Match[]): Promise<void> {
  for (const m of matches) await saveMatch(db, m);
}

/** Each tap happens a second after the last, so the double-tap guard never swallows a test click. */
export function spacedTaps(): void {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 1000));
}

/** Render the app's routes at `path` with an in-memory location. */
export function renderAt(path: string) {
  const location = memoryLocation({ path, record: true });
  function Shell() {
    useResumeOnLaunch();
    return <Routes />;
  }
  const result = render(
    <Router hook={location.hook}>
      <Shell />
    </Router>,
  );
  return { ...result, path: () => location.history.at(-1) };
}
