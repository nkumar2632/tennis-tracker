import { Router, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Routes, useResumeOnLaunch } from './routes';
import { UpdateBanner } from './UpdateBanner';

function Shell() {
  useResumeOnLaunch();
  const [location] = useLocation();
  // Never offer a reload mid-match: only on the home and settings screens.
  const showUpdates = location === '/' || location === '/settings';
  return (
    <>
      <UpdateBanner visible={showUpdates} />
      <Routes />
    </>
  );
}

export function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  );
}
