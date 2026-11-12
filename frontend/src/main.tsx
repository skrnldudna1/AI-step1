import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import CharacterWindow from './CharacterWindow';

import './index.css';

const isCharacterWindow =
  new URLSearchParams(window.location.search).get('mode') ===
  'character';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCharacterWindow ? <CharacterWindow /> : <App />}
  </StrictMode>
);