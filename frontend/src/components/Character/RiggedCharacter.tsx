
import { useEffect, useState } from 'react';

import type { CharacterRig } from '../../types/rig';
import type { CharacterReaction } from '../../types/character';

import './RiggedCharacter.css';

interface RiggedCharacterProps {
  rig: CharacterRig;
  reaction: CharacterReaction;
  isTalking?: boolean;
  isThinking?: boolean;
}

type Motion = 'breathing' | 'happy' | 'sad' | 'surprised' | 'thinking';

export default function RiggedCharacter({
  rig,
  reaction,
  isTalking = false,
  isThinking = false,
}: RiggedCharacterProps) {
  const expression = rig.expressions?.[reaction.emotion];

  // 입 모양 애니메이션
  const [mouthFrame, setMouthFrame] = useState(0);

  // 현재 몸동작
  const [motion, setMotion] = useState<Motion>('breathing');

  // 감정이 변경되거나 생각 상태에 진입하면 모션 시작
  useEffect(() => {
    if (isThinking && !isTalking) {
      setMotion('thinking');
      return;
    }

    if (
      reaction.emotion === 'happy' ||
      reaction.emotion === 'sad' ||
      reaction.emotion === 'surprised'
    ) {
      setMotion(reaction.emotion);
    } else {
      setMotion('breathing');
    }
  }, [reaction.emotion, isThinking, isTalking]);

  // 입 모양 변경
  useEffect(() => {
    if (!isTalking) {
      setMouthFrame(0);
      return;
    }

    const interval = setInterval(() => {
      setMouthFrame((prev) => (prev + 1) % 4);
    }, 150);

    return () => clearInterval(interval);
  }, [isTalking]);

  const mouthImages = rig.mouthVariants;

  const getMouthImage = (): string | null => {
    if (!mouthImages) return null;

    if (!isTalking) return mouthImages.closed;

    switch (mouthFrame) {
      case 0:
        return mouthImages.closed;
      case 1:
        return mouthImages.half;
      case 2:
        return mouthImages.open;
      case 3:
        return mouthImages.half;
      default:
        return mouthImages.closed;
    }
  };

  const currentMouthImage = getMouthImage();

  return (
    <div
      className={`rigged-character rigged-character-${motion}`}
      onAnimationEnd={(event) => {
        // 자식 파츠의 애니메이션 종료 이벤트는 무시
        if (event.target !== event.currentTarget) return;

        if (motion !== 'breathing') {
          setMotion('breathing');
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${rig.canvas.width} / ${rig.canvas.height}`,
        isolation: 'isolate',
        userSelect: 'none',
      }}
    >
      {rig.parts.map((part) => {
        const isMouth =
          part.type === 'mouth' ||
          part.id === 'mouth';

        const mouthSrc = isMouth
          ? currentMouthImage
          : null;

        const imageSrc =
          mouthSrc ??
          expression?.[part.id] ??
          part.src;

        const useFallbackTalking =
          isMouth &&
          isTalking &&
          !mouthImages;

        return (
          <img
            key={part.id}
            src={imageSrc}
            alt=""
            draggable={false}
            className={[
              'rig-part',
              `rig-part-${part.type}`,
              useFallbackTalking
                ? 'rig-part-talking'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-part={part.id}
            data-type={part.type}
            style={{
              position: 'absolute',
              left: `${(part.x / rig.canvas.width) * 100}%`,
              top: `${(part.y / rig.canvas.height) * 100}%`,
              width: `${(part.width / rig.canvas.width) * 100}%`,
              height: `${(part.height / rig.canvas.height) * 100}%`,
              transformOrigin:
                `${part.pivotX * 100}% ${part.pivotY * 100}%`,
              zIndex: part.zIndex,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </div>
  );
}
