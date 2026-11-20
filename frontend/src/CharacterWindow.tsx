import { useEffect, useState, useRef } from 'react';
import type { PointerEvent } from 'react';

import Character from './components/Character/Character';
import PomeranianCharacter from './components/Character/PomeranianCharacter';

import RiggedCharacter from './components/Character/RiggedCharacter';
import type { CharacterRig } from './types/rig';

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
  // 1. 캐릭터 및 감정 상태
  // ========================================

  const [characterType, setCharacterType] =
    useState<CharacterType>('pomeranian');

    const [customRig, setCustomRig] =
  useState<CharacterRig | null>(null);

  const [reaction, setReaction] =
    useState<CharacterReaction>(defaultReaction);

  const [isThinking, setIsThinking] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [reactionId, setReactionId] = useState(0);

  // ========================================
  // 2. 드래그 상태
  // ========================================

  const dragRef = useRef({
    isDown: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

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
// 커스텀 캐릭터 리깅 동기화
// ========================================

useEffect(() => {
  const api = window.step1;

  if (!api) return;

  let active = true;

  const unsubscribe = api.onCustomRigChanged((rig) => {
    setCustomRig(rig);
  });

  api.getCustomRig()
    .then((rig) => {
      if (active) {
        setCustomRig(rig);
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
  // 5. 클릭 및 드래그 처리
  // ========================================

  const handlePointerDown = (
    e: PointerEvent<HTMLDivElement>
  ) => {
    if (e.button !== 0 || !e.isPrimary) return;

    dragRef.current = {
      isDown: true,
      hasMoved: false,
      startX: e.screenX,
      startY: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (
    e: PointerEvent<HTMLDivElement>
  ) => {
    const drag = dragRef.current;

    if (!drag.isDown || !e.isPrimary) return;

    const distance = Math.hypot(
      e.screenX - drag.startX,
      e.screenY - drag.startY
    );

    if (!drag.hasMoved && distance < 5) return;

    drag.hasMoved = true;

    const dx = e.screenX - drag.lastX;
    const dy = e.screenY - drag.lastY;

    window.step1?.moveCharacter({ dx, dy });

    drag.lastX = e.screenX;
    drag.lastY = e.screenY;
  };

  const handlePointerUp = (
    e: PointerEvent<HTMLDivElement>
  ) => {
    const drag = dragRef.current;

    if (!drag.isDown || !e.isPrimary) return;

    drag.isDown = false;

    if (!drag.hasMoved) {
      window.step1?.toggleChat();
    }
  };

  const handlePointerCancel = () => {
    dragRef.current.isDown = false;
  };

  // ========================================
  // 6. 캐릭터 렌더링
  // ========================================

  return (
    <div
      className="desktop-character-window"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
    >
      {characterType === 'custom' && customRig ? (
  <RiggedCharacter
    rig={customRig}
    reaction={reaction}
  />
  ) : characterType === 'pomeranian' ? (
    <PomeranianCharacter
      emotion={reaction.emotion}
      isTalking={isTalking}
    />
  ) : (
    <Character
      characterType={
        characterType === 'custom' ? 'basic' : characterType
      }
      reaction={reaction}
      isThinking={isThinking}
      isTalking={isTalking}
      reactionId={reactionId}
    />
)}
    </div>
  );
}