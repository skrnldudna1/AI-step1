// 계증 구조 = 캐릭터>페이스>눈>눈2개 > / 입

import type { CharacterReaction } from '../../types/character';
import type { CSSProperties } from 'react';
import './Character.css';


interface CharacterProps {
  reaction: CharacterReaction;
  isThinking: boolean;
}

function Character({ reaction, isThinking }: CharacterProps) {
  console.log("캐릭터 Thinking 상태:", isThinking);
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
        className={`character-face emotion-${reaction.emotion} action-${reaction.action} ${isThinking ? 'is-thinking' : ''}`}
        style={characterStyle}
>
        <div className="character-eyes">
          <span className="character-eye"></span>
          <span className="character-eye"></span>
        </div>

        <div className="character-mouth"></div>
      </div>
    </div>
  );
}

export default Character;