import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import CharacterWindow from './CharacterWindow';
import ChatWindow from './ChatWindow';

import './index.css';

const mode = new URLSearchParams(window.location.search).get('mode');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mode === 'character' ? <CharacterWindow /> : mode === 'chat' ? <ChatWindow /> : <App />}
  </StrictMode>
);
