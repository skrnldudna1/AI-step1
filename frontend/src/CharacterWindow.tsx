import { useCallback, useEffect, useState, useRef } from 'react';
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
import { isCharacterPixel, prepareCharacterImage } from './characterHitTest';
import { createCharacterClickHandler } from './characterClick';

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
  const [characterSize, setCharacterSize] = useState(100);

  useEffect(() => {
    const api = window.step1;
    if (!api) return;
    let active = true;
    let receivedChange = false;
    const unsubscribe = api.onCharacterSizeChanged((size) => {
      receivedChange = true;
      setCharacterSize(size);
    });

    api.getCharacterSize()
      .then((size) => {
        if (active && !receivedChange && size !== null) {
          setCharacterSize(size);
        }
      })
      .catch(console.error);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

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
  const windowRef = useRef<HTMLDivElement>(null);
  const ignoredRef = useRef(true);
  const clickHandler = useRef<ReturnType<typeof createCharacterClickHandler> | null>(null);
  if (!clickHandler.current) {
    clickHandler.current = createCharacterClickHandler({
      onSingle: () => window.step1?.toggleChat(),
      onDouble: () => window.step1?.openSettings(),
    });
  }

  useEffect(() => () => clickHandler.current?.cancel(), []);

  const updateMouseInteraction = useCallback((point: { x: number; y: number } | null) => {
    const root = windowRef.current;
    // Pointer capture must not be interrupted when dragging across clear pixels.
    const ignore = !dragRef.current.isDown &&
      (!root || !point || !isCharacterPixel(root, point));
    if (ignoredRef.current !== ignore) {
      ignoredRef.current = ignore;
      window.step1?.setCharacterMouseIgnored?.(ignore);
    }
    if (root) root.dataset.characterHit = String(!ignore);
  }, []);

  useEffect(() => {
    const api = window.step1;
    if (!api?.onCharacterCursor) return;
    const unsubscribe = api.onCharacterCursor(updateMouseInteraction);
    const cancelOnBlur = () => {
      dragRef.current.isDown = false;
      clickHandler.current?.cancel();
      updateMouseInteraction(null);
    };
    window.addEventListener('blur', cancelOnBlur);
    return () => {
      unsubscribe();
      window.removeEventListener('blur', cancelOnBlur);
      ignoredRef.current = true;
      api.setCharacterMouseIgnored(true);
    };
  }, [updateMouseInteraction]);

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

    let active = true;
    let received = false;
    const apply = (state: NonNullable<Awaited<ReturnType<typeof api.getReactionState>>>) => {
      setReaction(state.reaction);
      setIsThinking(state.isThinking);
      setIsTalking(state.isTalking);
      setReactionId(state.reactionId);
    };
    const unsubscribe = api.onReactionChanged((state) => {
      received = true;
      apply(state);
    });
    api.getReactionState?.().then((state) => {
      if (active && !received && state) apply(state);
    }).catch(console.error);

    return () => {
      active = false;
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
    if (!isCharacterPixel(e.currentTarget, { x: e.clientX, y: e.clientY })) {
      updateMouseInteraction({ x: e.clientX, y: e.clientY });
      return;
    }

    dragRef.current = {
      isDown: true,
      hasMoved: false,
      startX: e.screenX,
      startY: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
    updateMouseInteraction({ x: e.clientX, y: e.clientY });
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

    if (!drag.hasMoved) clickHandler.current?.cancel();
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
      clickHandler.current?.click({ x: e.screenX, y: e.screenY });
    }
    updateMouseInteraction({ x: e.clientX, y: e.clientY });
  };

  const handlePointerCancel = () => {
    if (!dragRef.current.isDown) return;
    dragRef.current.isDown = false;
    clickHandler.current?.cancel();
    updateMouseInteraction(null);
  };

  // ========================================
  // 6. 캐릭터 렌더링
  // ========================================

  return (
    <div
      className="desktop-character-window"
      ref={windowRef}
      onLoadCapture={(e) => {
        if (e.target instanceof HTMLImageElement) prepareCharacterImage(e.target);
      }}
      onMouseMove={(e) => updateMouseInteraction({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => updateMouseInteraction(null)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
    >
      <div
        className="character-size-stage"
        style={{ zoom: characterSize / 100 }}
      >
        {characterType === 'custom' && customRig ? (
          <div style={{
            width: Math.min(250, 330 * customRig.canvas.width / customRig.canvas.height),
          }}>
            <RiggedCharacter
              rig={customRig}
              reaction={reaction}
              isTalking={isTalking}
              isThinking={isThinking}
              reactionId={reactionId}
            />
          </div>
        ) : characterType === 'pomeranian' ? (
          <PomeranianCharacter
            reaction={reaction}
            isTalking={isTalking}
            isThinking={isThinking}
            reactionId={reactionId}
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
    </div>
  );
}
