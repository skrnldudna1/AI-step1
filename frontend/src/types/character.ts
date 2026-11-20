
import type { Emotion } from './emotion';
import type { Action } from './action';

// 캐릭터의 감정, 강도, 행동
export interface CharacterReaction {
  emotion: Emotion;
  intensity: number;
  action: Action;
}

// 선택 가능한 캐릭터 종류
export type CharacterType =
  | 'basic'
  | 'illustration'
  | 'pomeranian'
  | 'custom';
