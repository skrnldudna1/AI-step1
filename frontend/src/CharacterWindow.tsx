import { useEffect, useState } from 'react';

import Character from './components/Character/Character';
import PomeranianCharacter from './components/Character/PomeranianCharacter';

import type {
  CharacterType,
  CharacterReaction,
} from './types/character';

import './CharacterWindow.css';

// ========================================
// 기본 감정 상태
// ========================================

const defaultReaction: CharacterReaction = {
  emotion: 'neutral',
  action: 'idle',
  intensity: 0.5,
};

export default function CharacterWindow() {
  // ========================================
  // 1. 캐릭터 선택 상태
  // ========================================

  const [characterType, setCharacterType] =
    useState<CharacterType>('pomeranian');

  // ========================================
  // 2. AI 감정 및 애니메이션 상태
  // ========================================

  const [reaction, setReaction] =
    useState<CharacterReaction>(defaultReaction);

  const [isThinking, setIsThinking] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [reactionId, setReactionId] = useState(0);

  // ========================================
  // 3. 캐릭터 선택 동기화
  // ========================================

  useEffect(() => {
    const api = window.step1;

    if (!api) return;

    let active = true;

    const unsubscribe = api.onCharacterChanged((type) => {
      setCharacterType(type);
    });

    api.getCharacter()
      .then((type) => {
        if (active) {
          setCharacterType(type);
        }
      })
      .catch(console.error);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // ========================================
  // 4. AI 감정 동기화
  // ========================================

  useEffect(() => {
    const api = window.step1;

    if (!api) return;

    const unsubscribe = api.onReactionChanged((state) => {
      setReaction(state.reaction);
      setIsThinking(state.isThinking);
      setIsTalking(state.isTalking);
      setReactionId(state.reactionId);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // ========================================
  // 5. 캐릭터 렌더링
  // ========================================

  return (
    <div className="desktop-character-window">
      {characterType === 'pomeranian' ? (
        <PomeranianCharacter
          emotion={reaction.emotion}
          isTalking={isTalking}
        />
      ) : (
        <Character
          characterType={characterType}
          reaction={reaction}
          isThinking={isThinking}
          isTalking={isTalking}
          reactionId={reactionId}
        />
      )}
    </div>
  );
}