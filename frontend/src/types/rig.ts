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

export type RigRegionId = 'head' | 'torso' | 'left_eye' | 'right_eye' | 'left_eyebrow' | 'right_eyebrow' |
  'nose' | 'mouth' | 'hair' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg' | 'tail' | 'accessory';
export interface RigPoint { x: number; y: number }
export interface RigRegion {
  id: RigRegionId;
  points: RigPoint[];
  pivot: RigPoint;
  mode: 'region' | 'detail';
}

export interface CharacterRig {
  id: string;
  name: string;

  canvas: {
    width: number;
    height: number;
  };
  
  mouthVariants?: {
    closed: string;
    half: string;
    open: string;
  } | null;

  parts: RigPart[];
  // Optional manual neck position (percent of canvas height).
  headSplit?: number;
  partLayoutVersion?: number;
  preserveFace?: boolean;
  mesh?: { src: string; regions: RigRegion[] };
  assetBase?: string;
  // Finished expression drawings, crossfaded inside the primary canvas.
  expressionRigs?: Partial<Record<Emotion, CharacterRig>>;

  expressions: Partial<Record<Emotion, RigExpression>>;
}

export interface RigGenerateResponse {
  status: string;
  filename: string;
  base_url: string;
  rig: CharacterRig;
  message: string;
}
