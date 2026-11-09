import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

import type { CharacterReaction } from '../../types/character';

import './ImageCharacter.css';

interface ImageCharacterProps {
  reaction: CharacterReaction;
  isThinking: boolean;
  isTalking: boolean;
  reactionId: number;
}

function ImageCharacter({
  reaction,
  isThinking,
  isTalking,
  reactionId,
}: ImageCharacterProps) {
  const characterRef = useRef<HTMLDivElement>(null);

  // 감정에 따른 이미지 선택
  const getImagePath = (): string => {
    if (isThinking) {
      return '/character/thinking.png';
    }

    switch (reaction.emotion) {
      case 'happy':
        return reaction.intensity >= 0.7
          ? '/character/excited.png'
          : '/character/happy.png';

      case 'surprised':
        return '/character/surprised.png';

      case 'sad':
        return '/character/confused.png';

      default:
        return '/character/neutral.png';
    }
  };

  // 감정 강도를 0~1로 제한
  const intensity = Math.min(1, Math.max(0, reaction.intensity));

  const characterStyle = {
    '--bounce-height': `${-(5 + intensity * 25)}px`,
  } as CSSProperties;

  // 같은 행동을 연속 실행할 수 있도록 애니메이션 재시작
  useEffect(() => {
    const character = characterRef.current;

    if (!character || reactionId === 0 || isThinking) {
      return;
    }

    character.style.animation = 'none';

    void character.offsetWidth;

    character.style.animation = '';
  }, [reactionId, isThinking]);

  return (
    <div className="image-character-container">
      <div
        ref={characterRef}
        className={[
          'image-character',
          `action-${reaction.action}`,
          isThinking ? 'is-thinking' : '',
          isTalking && !isThinking ? 'is-talking' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={characterStyle}
      >
        <img
          className="image-character-art"
          src={getImagePath()}
          alt="GPT Companion 일러스트 캐릭터"
          draggable={false}
        />
      </div>
    </div>
  );
}

export default ImageCharacter;