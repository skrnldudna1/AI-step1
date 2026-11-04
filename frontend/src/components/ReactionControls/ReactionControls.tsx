/* 캐릭터를 조작하는 UI (감정,슬라이더 버튼 등 )*/

import type { Emotion } from '../../types/emotion';
import type { Action } from '../../types/action';

import './ReactionControls.css';

interface ReactionControlsProps {
  emotion: Emotion;
  action: Action;
  intensity: number;

  onEmotionChange: (emotion: Emotion) => void;
  onActionChange: (action: Action) => void;
  onIntensityChange: (intensity: number) => void;
}

function ReactionControls({
  emotion,
  action,
  intensity,
  onEmotionChange,
  onActionChange,
  onIntensityChange,
}: ReactionControlsProps) {
  return (
    <section className="reaction-controls">
      <h2>캐릭터 반응 테스트</h2>

      <div className="emotion-buttons">
        <button onClick={() => onEmotionChange('neutral')}>
          기본
        </button>

        <button onClick={() => onEmotionChange('happy')}>
          기쁨
        </button>

        <button onClick={() => onEmotionChange('sad')}>
          슬픔
        </button>

        <button onClick={() => onEmotionChange('surprised')}>
          놀람
        </button>
      </div>

      <div className="action-buttons">
        <button onClick={() => onActionChange('idle')}>
          대기
        </button>

        <button onClick={() => onActionChange('nod')}>
          끄덕임
        </button>

        <button onClick={() => onActionChange('shake')}>
          좌우 흔들기
        </button>

        <button onClick={() => onActionChange('bounce')}>
          통통 튀기
        </button>
      </div>

      <div className="intensity-control">
        <label htmlFor="intensity-slider">
          감정 강도: {Math.round(intensity * 100)}%
        </label>

        <input
          id="intensity-slider"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={intensity}
          onChange={(event) =>
            onIntensityChange(Number(event.target.value))
          }
        />
      </div>

      <p className="reaction-status">
        현재 감정: {emotion} / 행동: {action}
      </p>
    </section>
  );
}

export default ReactionControls;