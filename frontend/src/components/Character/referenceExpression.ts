import type { CharacterRig, RigPoint, RigRegionId } from '../../types/rig';

export type ReferencePose = { x: number; y: number; sx: number; sy: number; angle: number; curve?: number };
export type ReferenceExpression = Partial<Record<RigRegionId, ReferencePose>>;
const facialIds: RigRegionId[] = ['left_eye', 'right_eye', 'left_eyebrow', 'right_eyebrow', 'mouth', 'nose'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
type FaceFrame = { origin: RigPoint; span: number; angle: number };
type Regions = Partial<Record<RigRegionId, RigPoint[]>>;

function regionsInPixels(rig: CharacterRig): Regions {
  const { width, height } = rig.canvas;
  const result: Regions = {};
  for (const region of rig.mesh?.regions ?? []) {
    if ((facialIds.includes(region.id) || region.id === 'head') && region.points.length >= 3)
      result[region.id] = region.points.map(p => ({ x: p.x * width, y: p.y * height }));
  }
  // Earlier rigs may have actual facial sprites but no mesh annotations.
  for (const part of rig.parts) {
    const id = part.id as RigRegionId;
    if ((!facialIds.includes(id) && id !== 'head') || result[id] || part.width <= 0 || part.height <= 0) continue;
    const { x, y, width: w, height: h } = part;
    result[id] = [{ x, y }, { x: x+w, y }, { x: x+w, y: y+h }, { x, y: y+h }];
  }
  return result;
}

function bounds(points: RigPoint[]) {
  const x0 = Math.min(...points.map(p => p.x)), x1 = Math.max(...points.map(p => p.x));
  const y0 = Math.min(...points.map(p => p.y)), y1 = Math.max(...points.map(p => p.y));
  const center = { x: (x0+x1)/2, y: (y0+y1)/2 };
  return { center, width: x1-x0, height: y1-y0 };
}

function eyeFrame(regions: Regions): FaceFrame | undefined {
  const left = regions.left_eye, right = regions.right_eye;
  if (!left || !right) return;
  const a = bounds(left).center, b = bounds(right).center;
  const span = Math.hypot(b.x-a.x, b.y-a.y);
  if (span < 2 || b.x <= a.x) return;
  return { origin: { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }, span, angle: Math.atan2(b.y-a.y, b.x-a.x) };
}

function headFrame(regions: Regions): FaceFrame | undefined {
  if (!regions.head) return;
  const box = bounds(regions.head);
  return box.width > 2 ? { origin: box.center, span: box.width, angle: 0 } : undefined;
}

function localPoints(points: RigPoint[], frame: FaceFrame) {
  const c = Math.cos(frame.angle), s = Math.sin(frame.angle);
  return points.map(p => ({ x: ((p.x-frame.origin.x)*c+(p.y-frame.origin.y)*s)/frame.span,
    y: (-(p.x-frame.origin.x)*s+(p.y-frame.origin.y)*c)/frame.span }));
}

// Estimate line tilt only for elongated shapes. A round eye or square region
// has no reliable orientation, so do not infer an angle from it.
function lineAngle(points: RigPoint[]) {
  const x = points.reduce((sum,p)=>sum+p.x,0)/points.length;
  const y = points.reduce((sum,p)=>sum+p.y,0)/points.length;
  let xx = 0, yy = 0, xy = 0;
  for (const p of points) { xx += (p.x-x)**2; yy += (p.y-y)**2; xy += (p.x-x)*(p.y-y); }
  const spread = Math.hypot(xx-yy, 2*xy);
  if (xx+yy < 1e-8 || spread / (xx+yy) < .45) return undefined;
  return Math.atan2(2*xy, xx-yy)/2;
}

// A traced mouth outline can carry curvature even when its bounding box is
// the same size. Sample its vertical midpoint at the corners and center.
function mouthCurve(points: RigPoint[]) {
  const box = bounds(points), start = box.center.x-box.width/2;
  const midpoint = (fraction: number) => {
    const x = start+box.width*fraction, crossings: number[] = [];
    for (let i=0;i<points.length;i++) {
      const a=points[i], b=points[(i+1)%points.length];
      if ((a.x<=x && b.x>x) || (b.x<=x && a.x>x)) crossings.push(a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));
    }
    return crossings.length>=2 ? (Math.min(...crossings)+Math.max(...crossings))/2 : undefined;
  };
  const a=midpoint(.2), b=midpoint(.5), c=midpoint(.8);
  return a !== undefined && b !== undefined && c !== undefined ? ((a+c)/2-b)/.36 : undefined;
}

/** Transfer only confirmed facial geometry, never pixels or body placement.
 * Normalize crop size, position and head roll using matched eye (or head)
 * anchors. Missing/ambiguous details are left to the normal expression pose.
 */
export function getReferenceExpression(primary: CharacterRig, reference?: CharacterRig): ReferenceExpression {
  if (!reference || primary.canvas.width <= 0 || primary.canvas.height <= 0) return {};
  const a = regionsInPixels(primary), b = regionsInPixels(reference);
  let primaryFrame = eyeFrame(a), referenceFrame = eyeFrame(b);
  if (!primaryFrame || !referenceFrame) { primaryFrame = headFrame(a); referenceFrame = headFrame(b); }
  if (!primaryFrame || !referenceFrame) return {};
  const result: ReferenceExpression = {};
  for (const id of facialIds) {
    const source = a[id], target = b[id];
    if (!source || !target) continue;
    const sourcePoints = localPoints(source, primaryFrame), targetPoints = localPoints(target, referenceFrame);
    const from = bounds(sourcePoints), to = bounds(targetPoints);
    if (Math.min(from.width, from.height, to.width, to.height) < .004) continue;
    const sx = clamp(to.width/from.width, .55, 1.6);
    const sy = clamp(to.height/from.height, .12, 2.25);
    const dx = clamp(to.center.x-from.center.x, -.13, .13), dy = clamp(to.center.y-from.center.y, -.18, .18);
    const lineFeature = id.endsWith('_eyebrow') || (id === 'mouth' && from.width > 1.4*from.height && to.width > 1.4*to.height);
    const pa = lineFeature ? lineAngle(sourcePoints) : undefined, pb = lineFeature ? lineAngle(targetPoints) : undefined;
    const delta = pa !== undefined && pb !== undefined ? pb-pa : 0;
    const angle = clamp(Math.atan2(Math.sin(delta*2), Math.cos(delta*2))/2, -.55, .55);
    const measuredCurve = id === 'mouth' && targetPoints.length >= 6 ? mouthCurve(targetPoints) : undefined;
    const sourceCurve = id === 'mouth' ? mouthCurve(sourcePoints) : undefined;
    const curve = measuredCurve !== undefined && sourceCurve !== undefined ? clamp(measuredCurve-sourceCurve*sy,-.25,.25) : undefined;
    // If no measurable difference was detected (e.g. copied polygons), use
    // the built-in emotion rather than freezing the character's expression.
    if (Math.max(Math.abs(sx-1), Math.abs(sy-1)) < .09 && Math.hypot(dx,dy) < .014 && Math.abs(angle) < .08 && Math.abs(curve ?? 0) < .012) continue;
    const c = Math.cos(primaryFrame.angle), s = Math.sin(primaryFrame.angle), span = primaryFrame.span;
    result[id] = { x: (dx*c-dy*s)*span/primary.canvas.width, y: (dx*s+dy*c)*span/primary.canvas.height, sx, sy, angle,
      ...(curve !== undefined ? {curve:curve*span/primary.canvas.height} : {}) };
  }
  return result;
}
