import { useEffect } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { db } from '../storage/db';
import { getSetting, requestPersistentStorage } from '../storage/repo';
import { DebugApp } from './DebugApp';
import { SettingsGate } from './hooks';
import { ChartScreen } from './screens/Chart';
import { HomeScreen } from './screens/Home';
import { MatchScreen } from './screens/MatchScreen';
import { PointEditorScreen, PointsScreen } from './screens/Points';
import { SettingsScreen } from './screens/Settings';
import { EditMatchScreen, NewMatchScreen } from './screens/Setup';
import { loadMatch } from './store';

export function Routes() {
  return (
    <SettingsGate>
      <Switch>
        <Route path="/">{() => <HomeScreen />}</Route>
        <Route path="/new">{() => <NewMatchScreen />}</Route>
        <Route path="/settings">{() => <SettingsScreen />}</Route>
        <Route path="/debug">{() => <DebugApp />}</Route>
        <Route path="/match/:id">{(p) => <MatchScreen key={p.id} id={p.id} tab="stats" />}</Route>
        <Route path="/match/:id/timeline">{(p) => <MatchScreen key={p.id} id={p.id} tab="timeline" />}</Route>
        <Route path="/match/:id/report">{(p) => <MatchScreen key={p.id} id={p.id} tab="report" />}</Route>
        <Route path="/match/:id/chart">{(p) => <ChartScreen key={p.id} id={p.id} />}</Route>
        <Route path="/match/:id/edit">{(p) => <EditMatchScreen key={p.id} id={p.id} />}</Route>
        <Route path="/match/:id/points">{(p) => <PointsScreen key={p.id} id={p.id} />}</Route>
        {(['points', 'timeline'] as const).flatMap((list) => [
          <Route key={`${list}-insert`} path={`/match/:id/${list}/insert/:beforeId`}>
            {(p) => <PointEditorScreen key={`insert-${p.beforeId}`} id={p.id} beforeId={p.beforeId} list={list} />}
          </Route>,
          <Route key={`${list}-edit`} path={`/match/:id/${list}/:pointId`}>
            {(p) => <PointEditorScreen key={p.pointId} id={p.id} pointId={p.pointId} list={list} />}
          </Route>,
        ])}
        <Route>{() => <HomeScreen />}</Route>
      </Switch>
    </SettingsGate>
  );
}

/** On launch, go straight back to a match that was being charted when the app closed. */
export function useResumeOnLaunch() {
  const [location, navigate] = useLocation();
  useEffect(() => {
    void requestPersistentStorage();
    if (location !== '/') return;
    void (async () => {
      const id = await getSetting(db, 'activeMatchId');
      const match = id ? await loadMatch(id) : undefined;
      if (match?.status === 'in_progress') navigate(`/match/${match.id}/chart`, { replace: true });
    })();
  }, []); // Only on launch.
}
