import type { CharacterReaction } from '../../types/character';
import type { RigPoint, RigRegion } from '../../types/rig';
import type { VisualEmotion } from '../../types/emotion';
import type { ReferencePose } from './referenceExpression';

export type MeshPose = { x: number; y: number; sx: number; sy: number; angle: number; smile: number };
export const neutralMeshPose = (): MeshPose => ({ x: 0, y: 0, sx: 1, sy: 1, angle: 0, smile: 0 });
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const smooth = (v: number) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const face = (id: string) => id.endsWith('_eye') || id.endsWith('_eyebrow') || id === 'mouth' || id === 'nose';
type Control = { region: RigRegion; center: RigPoint; width: number; height: number; aspect: number; weight: Float32Array; affected: Uint32Array; triangles: Uint32Array };

function polygonDistance(x: number, y: number, points: RigPoint[], aspect: number) {
  let inside = false, distance = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    const ax = (x - a.x) * aspect, ay = y - a.y;
    const bx = (b.x - a.x) * aspect, by = b.y - a.y;
    const t = clamp((ax * bx + ay * by) / Math.max(bx * bx + by * by, 1e-10), 0, 1);
    distance = Math.min(distance, Math.hypot(ax - t * bx, ay - t * by));
  }
  return inside ? 0 : distance;
}

export function createRigMesh(regions: RigRegion[], aspect: number, subdivisions = 88) {
  const grid = clamp(Math.round(subdivisions), 4, 120);
  const stride = grid + 1;
  const vertices = new Float32Array(stride * stride * 2);
  const indices = new Uint16Array(grid * grid * 6);
  for (let row = 0; row <= grid; row++) for (let col = 0; col <= grid; col++) {
    const i = 2 * (row * stride + col);
    vertices[i] = col / grid; vertices[i + 1] = row / grid;
  }
  let ix = 0;
  for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
    const i = row * stride + col;
    indices.set([i, i + 1, i + stride, i + 1, i + stride + 1, i + stride], ix); ix += 6;
  }
  const controls: Control[] = [];
  for (const region of regions) {
    if (!face(region.id) && !['head', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'tail'].includes(region.id)) continue;
    if (region.points.length < 3) continue;
    const x0 = Math.min(...region.points.map(p => p.x)), x1 = Math.max(...region.points.map(p => p.x));
    const y0 = Math.min(...region.points.map(p => p.y)), y1 = Math.max(...region.points.map(p => p.y));
    const width = Math.max(x1 - x0, .008), height = Math.max(y1 - y0, .008);
    const center = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    // Features have a surrounding cushion of unchanged skin; joints fade
    // into the torso. A continuous field prevents cutout edges and gaps.
    const radius = face(region.id)
      ? clamp(Math.max(width * aspect, height) * 1.2, .022, .11)
      : clamp(Math.min(width * aspect, height) * .35, .025, .085);
    // Hair and head accessories must follow the neck pivot as well (including
    // hats that extend beyond the face contour). Do not move torso jewelry.
    const shapes = [region, ...(region.id === 'head' ? regions.filter(other =>
      other.id === 'hair' || (other.id === 'accessory' &&
        other.points.reduce((sum, p) => sum + p.y, 0) / Math.max(1, other.points.length) < region.pivot.y)) : [])];
    const allPoints = shapes.flatMap(shape => shape.points);
    const minX = Math.min(...allPoints.map(p => p.x)), maxX = Math.max(...allPoints.map(p => p.x));
    const minY = Math.min(...allPoints.map(p => p.y)), maxY = Math.max(...allPoints.map(p => p.y));
    const weight = new Float32Array(vertices.length / 2);
    for (let i = 0; i < weight.length; i++) {
      const x = vertices[i * 2], y = vertices[i * 2 + 1];
      if (x < minX - radius / aspect || x > maxX + radius / aspect || y < minY - radius || y > maxY + radius) continue;
      const distance = Math.min(...shapes.map(shape => polygonDistance(x, y, shape.points, aspect)));
      weight[i] = 1 - smooth(distance / radius);
    }
    const verticesWithWeight: number[] = [], touchingTriangles: number[] = [];
    for (let i = 0; i < weight.length; i++) if (weight[i] > 0) verticesWithWeight.push(i);
    for (let i = 0; i < indices.length; i += 3) if (weight[indices[i]] || weight[indices[i+1]] || weight[indices[i+2]]) touchingTriangles.push(i);
    controls.push({ region, center, width, height, aspect, weight, affected: Uint32Array.from(verticesWithWeight), triangles: Uint32Array.from(touchingTriangles) });
  }
  return { vertices, indices, controls, aspect, minArea: .06 / (grid * grid), scratch: new Float32Array(vertices.length) };
}

export type RigMesh = ReturnType<typeof createRigMesh>;

export function meshMotion(control: Control, emotion: VisualEmotion, reaction: CharacterReaction, time: number, talking: boolean, reduced: boolean, reference?: ReferencePose): MeshPose {
  const { region, width, height, aspect } = control;
  const id = region.id, side = id.startsWith('left') ? -1 : 1;
  const intensity = clamp(reaction.intensity, .15, 1);
  // At the usual 50% slider setting facial expressions should still be
  // clearly visible at desktop-avatar size. Keep body gestures gentle.
  const facialIntensity = Math.pow(clamp(reaction.intensity, 0, 1), .35);
  const pose = neutralMeshPose();
  const set = (x = 0, y = 0, sx = 1, sy = 1, angle = 0, smile = 0) => {
    const strength = face(id) ? facialIntensity : intensity;
    // Thin line eyebrows and mouths still need noticeable motion; use their
    // width as a scale reference instead of a few pixels of stroke height.
    const travel = id.endsWith('_eyebrow') ? Math.max(height, width * aspect * .32) : id === 'mouth' ? Math.max(height, width * aspect * .38) : height;
    pose.x = x * width * strength; pose.y = y * travel * strength;
    pose.sx = 1 + (sx - 1) * strength; pose.sy = 1 + (sy - 1) * strength;
    pose.angle = angle * strength; pose.smile = smile * travel * strength;
  };
  if (id.endsWith('_eye')) {
    if (emotion === 'happy') set(0, -.04, 1.15, .25);
    else if (emotion === 'excited') set(0, -.14, 1.2, .45);
    else if (emotion === 'affectionate') set(0, .02, 1.1, .32);
    else if (emotion === 'sad') set(0, .12, .95, .59, side * .18);
    else if (emotion === 'angry') set(0, .06, 1.12, .43, -side * .24);
    else if (emotion === 'surprised') set(0, -.12, 1.26, 1.65);
    else if (emotion === 'sleepy') set(0, .10, 1.05, .08);
    else if (emotion === 'shy') set(.16, .12, .88, .42);
    else if (emotion === 'thinking') set(.07, -.035, 1, .94);
    else if (emotion === 'confused') set(0, 0, 1, side < 0 ? 1.34 : .42);
    else if (emotion === 'playful') set(0, 0, 1.1, side < 0 ? .07 : 1.12);
  } else if (id.endsWith('_eyebrow')) {
    if (['happy', 'excited', 'affectionate'].includes(emotion)) set(0, -.55, 1, 1, side * .10);
    else if (emotion === 'surprised') set(0, -.9, 1.08, 1.05);
    else if (emotion === 'angry') set(0, .40, 1.04, 1, -side * .42);
    else if (emotion === 'sad') set(0, -.10, 1, 1, side * .40);
    else if (emotion === 'confused') set(0, side < 0 ? -.8 : .22, 1, 1, side * .16);
    else if (emotion === 'thinking') set(0, -.10);
    else if (emotion === 'sleepy') set(0, .15);
  } else if (id === 'mouth') {
    if (emotion === 'happy' || emotion === 'affectionate') set(0, 0, 1.32, 1.16, 0, -.67);
    else if (emotion === 'excited') set(0, 0, 1.36, 1.65, 0, -.60);
    else if (emotion === 'playful') set(0, 0, 1.24, 1.12, -.14, -.47);
    else if (emotion === 'sad') set(0, .12, .9, .88, 0, .78);
    else if (emotion === 'angry') set(0, .05, 1.03, .78, 0, .52);
    else if (emotion === 'surprised') set(0, 0, .72, 1.85);
    else if (emotion === 'thinking' || emotion === 'shy') set(0, 0, .84, .91);
    else if (emotion === 'confused') set(0, 0, .92, 1, -.12);
  } else if (id === 'nose') {
    if (emotion === 'angry') set(0, -.045, 1.03, .93);
    else if (emotion === 'surprised') set(0, -.035, 1.02, 1.04);
  } else if (id === 'head' && !reduced) {
    if (emotion === 'thinking') pose.angle = .035 * Math.sin(time * 1.5);
    else if (reaction.action === 'nod' && time < .8) pose.sy = 1 - .055 * intensity * Math.sin(time / .8 * Math.PI);
    else if (reaction.action === 'shake' && time < .8) pose.angle = .075 * intensity * Math.sin(time / .8 * 2 * Math.PI);
    else if (['confused', 'shy', 'playful'].includes(emotion)) pose.angle = .05 * intensity * Math.sin(time * 2);
  } else if (!reduced && (id.endsWith('_arm') || id.endsWith('_leg') || id === 'tail')) {
    const active = reaction.action === 'bounce' || emotion === 'excited' || emotion === 'playful';
    if (id === 'tail') pose.angle = (active ? .12 : .045) * Math.sin(time * (active ? 7 : 2));
    else if (active || (talking && id.endsWith('_arm'))) pose.angle = (active ? .13 : .065) * intensity * side * Math.sin(time * (active ? 7 : 4));
  }
  if (reference && face(id) && emotion !== 'neutral' && emotion !== 'thinking') {
    // Use the matched facial feature's relative geometry while preserving
    // the original pixels and a little of the emotion's directional curve.
    const blend = .85;
    pose.x = pose.x * (1-blend) + reference.x * facialIntensity * blend;
    pose.y = pose.y * (1-blend) + reference.y * facialIntensity * blend;
    pose.sx = pose.sx * (1-blend) + (1+(reference.sx-1)*facialIntensity) * blend;
    pose.sy = pose.sy * (1-blend) + (1+(reference.sy-1)*facialIntensity) * blend;
    pose.angle = pose.angle * (1-blend) + reference.angle * facialIntensity * blend;
    pose.smile = reference.curve !== undefined ? pose.smile * (1-blend) + reference.curve * facialIntensity * blend : pose.smile * .72;
  }
  if (!reduced && id.endsWith('_eye')) {
    const phase = (time % 4.1 + 4.1) % 4.1;
    const blink = Math.max(0, 1 - Math.abs(phase - 3.72) / .14);
    pose.sy *= 1 - .91 * smooth(blink);
  }
  if (id === 'mouth' && talking && !reduced) pose.sy *= .90 + .65 * (.5 + .5 * Math.sin(time * 22));
  return pose;
}

export function deformRigMesh(mesh: RigMesh, poses: MeshPose[], output: Float32Array<ArrayBuffer>) {
  output.set(mesh.vertices);
  const { aspect } = mesh;
  const previous = mesh.scratch;
  const valid = (triangles: Uint32Array) => {
    for (const i of triangles) {
      const a = mesh.indices[i] * 2, b = mesh.indices[i+1] * 2, c = mesh.indices[i+2] * 2;
      const area = (output[b] - output[a]) * (output[c+1] - output[a+1]) - (output[b+1] - output[a+1]) * (output[c] - output[a]);
      if (!(area > mesh.minArea)) return false;
    }
    return true;
  };
  // Apply feature corrections first, then the head and joints. Neighboring
  // vertices interpolate the same texture instead of independent sprites.
  const order = mesh.controls.map((_, i) => i).sort((a, b) => Number(face(mesh.controls[b].region.id)) - Number(face(mesh.controls[a].region.id)));
  for (const index of order) {
    const control = mesh.controls[index], pose = poses[index];
    if (!pose || (pose.x === 0 && pose.y === 0 && pose.sx === 1 && pose.sy === 1 && pose.angle === 0 && pose.smile === 0)) continue;
    const pivot = face(control.region.id) ? control.center : control.region.pivot;
    const sin = Math.sin(pose.angle), cos = Math.cos(pose.angle);
    for (const i of control.affected) {
      const weight = control.weight[i];
      const j = i * 2, x = output[j], y = output[j + 1];
      previous[j] = x; previous[j+1] = y;
      const dx = (x - pivot.x) * aspect, dy = y - pivot.y;
      const tx = (dx * pose.sx * cos - dy * pose.sy * sin) / aspect + pivot.x + pose.x;
      const curve = pose.smile * clamp(Math.pow((x - pivot.x) / (control.width / 2), 2), 0, 1);
      const ty = dx * pose.sx * sin + dy * pose.sy * cos + pivot.y + pose.y + curve;
      output[j] += (tx - x) * weight;
      output[j + 1] += (ty - y) * weight;
    }
    // Limit only the region that would fold a triangle. An overactive arm or
    // overlapping eyebrow should not suppress the rest of the expression.
    let accepted = valid(control.triangles);
    for (let attempt = 0; !accepted && attempt < 9; attempt++) {
      for (const i of control.affected) {
        const j = i * 2;
        output[j] = previous[j] + (output[j] - previous[j]) * .72;
        output[j+1] = previous[j+1] + (output[j+1] - previous[j+1]) * .72;
      }
      accepted = valid(control.triangles);
    }
    if (!accepted) {
      for (const i of control.affected) {
        const j = i * 2;
        output[j] = previous[j]; output[j+1] = previous[j+1];
      }
    }
  }
  return output;
}
