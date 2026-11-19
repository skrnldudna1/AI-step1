import type { Emotion } from './emotion';

export type RigPartType =
  | 'body'
  | 'head'
  | 'eyes'
  | 'eyebrow'
  | 'mouth'
  | 'nose'
  | 'hair'
  | 'arm'
  | 'leg'
  | 'tail'
  | 'accessory';

export interface RigPart {
  id: string;
  type: RigPartType;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  zIndex: number;
  variants?: Record<string, string>;
}

export type RigExpression = Record<string, string>;

export interface CharacterRig {
  id: string;
  name: string;

  canvas: {
    width: number;
    height: number;
  };

  parts: RigPart[];

  expressions: Partial<Record<Emotion, RigExpression>>;
}

export interface RigGenerateResponse {
  status: string;
  filename: string;
  base_url: string;
  rig: CharacterRig;
  message: string;
}