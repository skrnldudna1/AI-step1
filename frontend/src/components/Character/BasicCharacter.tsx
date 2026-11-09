// 계증 구조 = 캐릭터>페이스>눈>눈2개 > / 입

import type { CharacterReaction } from '../../types/character';
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import './BasicCharacter.css';


interface CharacterProps {
  reaction: CharacterReaction;
  isThinking: boolean;
  isTalking: boolean;
  reactionId: number;
}

function BasicCharacter({
  reaction,
  isThinking,
  isTalking,
  reactionId,
}: CharacterProps) {

  console.log("캐릭터 Thinking 상태:", isThinking);
    
  const faceRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const face = faceRef.current;

  if (!face || reactionId === 0 || isThinking) return;

  // 현재 애니메이션을 초기화
  face.style.animation = 'none';

  // 브라우저에 스타일 변경을 반영
  void face.offsetWidth;

  // CSS에 정의된 애니메이션 다시 실행
  face.style.animation = '';
}, [reactionId, isThinking]);
  
    const intensity = Math.min(1, Math.max(0, reaction.intensity));
    // 감정 강도를 0~1 범위로 제한
    const bounceHeight = 5 + intensity * 25;
    // 감정 강도에 따른 이동 거리 계산

    const characterStyle = {
        '--bounce-height': `-${bounceHeight}px`,
      } as CSSProperties;
      // React에서 CSS 변수 전달

  return (
    <div className="character-container">
      <div
        ref={faceRef}
        className={`
          character-face
          emotion-${reaction.emotion}
          action-${reaction.action}
          ${isThinking ? 'is-thinking' : ''}
          ${isTalking && !isThinking ? 'is-talking' : ''}
        `}
        style={characterStyle}
  >
        <div className="character-eyes">
          <span className="eye-wrapper">
            <span className="character-eye"></span>
          </span>

          <span className="eye-wrapper">
            <span className="character-eye"></span>
          </span>
        </div>

        <div className="character-mouth"></div>
      </div>
    </div>
  );
}

export default BasicCharacter;