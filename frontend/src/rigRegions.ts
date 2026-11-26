import type { RigPoint, RigRegion, RigRegionId } from './types/rig';

export const RIG_PART_LABELS: Record<RigRegionId, string> = {
  head: '머리 / 얼굴', torso: '몸통', left_eye: '왼쪽 눈', right_eye: '오른쪽 눈',
  left_eyebrow: '왼쪽 눈썹', right_eyebrow: '오른쪽 눈썹', nose: '코', mouth: '입',
  hair: '머리카락', left_arm: '왼쪽 팔', right_arm: '오른쪽 팔', left_leg: '왼쪽 다리',
  right_leg: '오른쪽 다리', tail: '꼬리', accessory: '장식',
};
export const isRigRegionId = (id: string): id is RigRegionId => Object.hasOwn(RIG_PART_LABELS, id);
export const isFaceRegion = (id: RigRegionId) => ['left_eye', 'right_eye', 'left_eyebrow', 'right_eyebrow', 'nose', 'mouth'].includes(id);
export const clampPoint = ({ x, y }: RigPoint): RigPoint => ({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });

export function rectanglePoints(a: RigPoint, b: RigPoint): RigPoint[] {
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
  return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
}

export function polygonArea(points: RigPoint[]) {
  return Math.abs(points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length];
    return sum + a.x * b.y - b.x * a.y;
  }, 0)) / 2;
}

export function pivotForRegion(id: RigRegionId, points: RigPoint[]): RigPoint {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const t = id === 'head' ? .92 : /_(arm|leg)$/.test(id) ? .12 : .5;
  return { x: (minX + maxX) / 2, y: minY + (maxY - minY) * t };
}

export function moveRegion(region: RigRegion, dx: number, dy: number): RigRegion {
  const points = [...region.points, region.pivot];
  const x = Math.max(-Math.min(...points.map(p => p.x)), Math.min(dx, 1 - Math.max(...points.map(p => p.x))));
  const y = Math.max(-Math.min(...points.map(p => p.y)), Math.min(dy, 1 - Math.max(...points.map(p => p.y))));
  return { ...region, points: region.points.map(p => ({ x: p.x + x, y: p.y + y })), pivot: { x: region.pivot.x + x, y: region.pivot.y + y } };
}
