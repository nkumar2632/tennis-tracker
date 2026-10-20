import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DebugApp } from './ui/DebugApp';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DebugApp />
  </StrictMode>,
);
