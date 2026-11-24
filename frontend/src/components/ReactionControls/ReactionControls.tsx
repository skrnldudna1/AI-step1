/* 캐릭터를 조작하는 UI (감정,슬라이더 버튼 등 )*/

import type { Emotion } from '../../types/emotion';
import { EMOTIONS, EMOTION_CONFIG } from '../../types/emotion';
import type { Action } from '../../types/action';
import type { ReactNode } from 'react';

import './ReactionControls.css';

interface ReactionControlsProps {
  emotion: Emotion;
  action: Action;
  intensity: number;
  preview?: ReactNode;
  previewName?: string;
  isThinking?: boolean;

  onEmotionChange: (emotion: Emotion) => void;
  onActionChange: (action: Action) => void;
  onIntensityChange: (intensity: number) => void;
}

function ReactionControls({
  emotion,
  action,
  intensity,
  preview,
  previewName,
  isThinking = false,
  onEmotionChange,
  onActionChange,
  onIntensityChange,
}: ReactionControlsProps) {
  return (
    <section className="reaction-controls">
      <h2>표정과 움직임</h2>
      <p className="reaction-description">친구가 어떤 표정을 짓는지 직접 확인해 보세요.</p>
      {preview && <div className="emotion-preview">
        <div className="emotion-preview-art">{preview}</div>
        <div className="emotion-preview-caption">
          <small>실시간 표정 · 11가지</small>
          <strong>{previewName}</strong>
          <span>{isThinking ? '생각하는 중…' : `${EMOTION_CONFIG[emotion].icon} ${EMOTION_CONFIG[emotion].label}`}</span>
        </div>
      </div>}

      <p className="control-label">감정</p>
      <div className="emotion-buttons" role="group" aria-label="감정 선택">
        {EMOTIONS.map(value => <button key={value} type="button" aria-pressed={emotion === value}
          onClick={() => onEmotionChange(value)}><span className="emotion-icon" aria-hidden="true">{EMOTION_CONFIG[value].icon}</span><span>{EMOTION_CONFIG[value].label}</span></button>)}
      </div>

      <p className="control-label">움직임</p>
      <div className="action-buttons" role="group" aria-label="행동 선택">
        <button type="button" aria-pressed={action === 'idle'} onClick={() => onActionChange('idle')}>대기</button>
        <button type="button" aria-pressed={action === 'nod'} onClick={() => onActionChange('nod')}>끄덕임</button>
        <button type="button" aria-pressed={action === 'shake'} onClick={() => onActionChange('shake')}>흔들기</button>
        <button type="button" aria-pressed={action === 'bounce'} onClick={() => onActionChange('bounce')}>통통 튀기</button>
      </div>

      <div className="intensity-control">
        <div className="intensity-head"><label htmlFor="intensity-slider">감정 강도</label><output htmlFor="intensity-slider">{Math.round(intensity * 100)}%</output></div>

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
        <span>현재 반응</span> <strong>{EMOTION_CONFIG[emotion].label}</strong>
        <span>·</span><strong>{{ idle: '대기', nod: '끄덕임', shake: '흔들기', bounce: '통통 튀기' }[action]}</strong>
      </p>
    </section>
  );
}

export default ReactionControls;
