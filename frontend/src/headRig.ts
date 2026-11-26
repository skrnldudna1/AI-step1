import type { CharacterRig, RigPart } from './types/rig';

export type ClipPoint = readonly [number, number];
export type ClipPolygon = readonly ClipPoint[];
export type HeadPlan = { mode: 'whole' | 'separate' | 'clipped'; pivotX: number; pivotY: number; neckY: number; base?: RigPart };

export const POM_HEAD_CLIP: ClipPolygon = [
  [0, 0], [100, 0], [100, 58], [86, 61], [75, 63], [64, 65], [51, 67],
  [39, 65], [27, 63], [15, 61], [0, 57],
];
export const POM_BODY_CLIP: ClipPolygon = [
  [0, 51], [15, 55], [27, 57], [39, 59], [51, 61], [64, 59], [75, 57],
  [86, 55], [100, 52], [100, 100], [0, 100],
];

export function horizontalSplit(neckY: number, overlap = 5) {
  const cut = Math.max(1, Math.min(99, neckY));
  return {
    head: [[0, 0], [100, 0], [100, cut], [0, cut]] as ClipPolygon,
    body: [[0, Math.max(0, cut - overlap)], [100, Math.max(0, cut - overlap)], [100, 100], [0, 100]] as ClipPolygon,
  };
}

export function clipPath(points: ClipPolygon) {
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
}

// Matching the actual clipped sprites is essential to transparent click-through.
export function pointInPolygon(x: number, y: number, points: ClipPolygon) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[j];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-6 && x >= Math.min(ax,bx) && x <= Math.max(ax,bx) && y >= Math.min(ay,by) && y <= Math.max(ay,by)) return true;
    if (((ay > y) !== (by > y)) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

const faceTypes = ['eyes', 'eyebrow', 'mouth', 'nose'];
const centerX = (part: RigPart) => part.x + part.width / 2;
const centerY = (part: RigPart) => part.y + part.height / 2;
const percent = (n: number, total: number) => n / total * 100;
const bound = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function getRigSplitRange(rig: CharacterRig) {
  const faceBottom = Math.max(0, ...rig.parts.filter(part => faceTypes.includes(part.type)).map(part => part.y + part.height));
  return { min: Math.ceil(bound(percent(faceBottom, rig.canvas.height) + 2, 12, 95)), max: 94 };
}

export function getRigHeadPlan(rig: CharacterRig): HeadPlan {
  const { width, height } = rig.canvas;
  const head = rig.parts.find(part => part.type === 'head');
  if (head) {
    const pivotY = percent(head.y + head.height * (rig.partLayoutVersion === 2 ? head.pivotY : .9), height);
    const pivotX = rig.partLayoutVersion === 2 ? percent(head.x + head.width * head.pivotX, width) : percent(centerX(head), width);
    return { mode: 'separate', pivotX, pivotY, neckY: pivotY };
  }
  const base = rig.parts.find(part => part.type === 'body' && part.width >= width * .7 && part.height >= height * .7);
  const eyes = rig.parts.filter(part => part.type === 'eyes').sort((a,b) => centerX(a) - centerX(b));
  const mouth = rig.parts.find(part => part.type === 'mouth');
  const left = eyes[0], right = eyes.at(-1);
  const spread = left && right ? centerX(right) - centerX(left) : 0;
  const pivotX = spread > 0 && left && right ? percent((centerX(left)+centerX(right))/2, width) : 50;
  const whole: HeadPlan = { mode: 'whole', pivotX, pivotY: 78, neckY: 78, base };
  if (!base) return whole;
  const faceBottom = Math.max(0, ...rig.parts.filter(part => faceTypes.includes(part.type)).map(part => part.y + part.height));
  const minCut = getRigSplitRange(rig).min;
  if (rig.headSplit !== undefined && Number.isFinite(rig.headSplit) && minCut < 94) {
    const neckY = bound(rig.headSplit, minCut, 94);
    return { mode: 'clipped', pivotX, pivotY: neckY, neckY, base };
  }
  if (!mouth || !left || !right || spread <= 0) return whole;
  const eyeY = (centerY(left) + centerY(right)) / 2;
  const estimated = Math.max(faceBottom + spread * .13, centerY(mouth) + Math.max(spread * .45, (centerY(mouth)-eyeY)*.65));
  // Do not split face-only avatars or guess a body when the landmarks don't
  // leave enough room for a plausible torso. A manual split can override this.
  if (estimated >= height || height - estimated < Math.max(height * .23, spread * .8)) return whole;
  const neckY = bound(percent(estimated, height), minCut, 94);
  return { mode: 'clipped', pivotX, pivotY: neckY, neckY, base };
}

export function isHeadPart(part: RigPart, plan: HeadPlan, canvasHeight: number) {
  if (['head', 'eyes', 'eyebrow', 'mouth', 'nose', 'hair'].includes(part.type)) return true;
  return part.type === 'accessory' && percent(centerY(part), canvasHeight) < plan.neckY;
}
