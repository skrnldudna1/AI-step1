// 감정, 강도, 행동을 하나의 데이터로 묶기

import type { Emotion } from './emotion';
import type { Action } from './action';

export interface CharacterReaction {
  emotion: Emotion;
  intensity: number;
  action: Action;
}
export type CharacterType = 'basic' | 'illustration'| 'pomeranian';