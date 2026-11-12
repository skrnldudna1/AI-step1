import { useEffect, useState } from 'react';

import Character from './components/Character/Character';
import PomeranianCharacter from './components/Character/PomeranianCharacter';

import type { CharacterType } from './types/character';

import './CharacterWindow.css';

export default function CharacterWindow() {
  const [characterType, setCharacterType] =
    useState<CharacterType>('pomeranian');

  useEffect(() => {
    const api = window.step1;

    if (!api) return;

    let active = true;

    const unsubscribe = api.onCharacterChanged((type) => {
      setCharacterType(type);
    });

    api.getCharacter().then((type) => {
      if (active) {
        setCharacterType(type);
      }
    }).catch(console.error);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="desktop-character-window">
      {characterType === 'pomeranian' ? (
        <PomeranianCharacter emotion="neutral" />
      ) : (
        <Character
          characterType={characterType}
          reaction={{
            emotion: 'neutral',
            intensity: 0,
            action: 'idle',
          }}
          isThinking={false}
          isTalking={false}
          reactionId={0}
        />
      )}
    </div>
  );
}