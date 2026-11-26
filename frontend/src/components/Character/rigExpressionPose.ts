import type { VisualEmotion } from '../../types/emotion';
import type { RigPart } from '../../types/rig';

type Pose = { x: number; y: number; sx: number; sy: number; angle: number };
const neutral: Pose = { x: 0, y: 0, sx: 1, sy: 1, angle: 0 };

// Percentage-based transformations keep arbitrary uploaded image geometry
// intact. Explicit expression artwork always wins over these fallbacks.
export function getRigExpressionPose(part: RigPart, emotion: VisualEmotion, canvasWidth: number): Pose {
  const left = part.id.includes('left') || (!part.id.includes('right') && part.x + part.width / 2 < canvasWidth / 2);
  const sign = left ? 1 : -1;
  const pose = (patch: Partial<Pose>): Pose => ({ ...neutral, ...patch });
  if (part.type === 'eyes') {
    switch (emotion) {
      case 'thinking': return pose({ x: 6, y: -4, sy: .88 });
      case 'happy': return pose({ sx: 1.1, sy: .48 });
      case 'excited': return pose({ sx: 1.18, sy: .62, y: -9 });
      case 'sad': return pose({ sy: .72, angle: -sign * 14, y: 8 });
      case 'shy': return pose({ x: 12, y: 17, sx: .87, sy: .56 });
      case 'angry': return pose({ sy: .52, angle: sign * 18 });
      case 'confused': return pose({ sx: left ? 1.08 : .82, sy: left ? 1.1 : .68, angle: sign * 10 });
      case 'sleepy': return pose({ sy: .18, y: 12 });
      case 'surprised': return pose({ sx: 1.14, sy: 1.25 });
      case 'playful': return pose({ sy: left ? 1 : .10, sx: left ? 1.05 : 1.15 });
      case 'affectionate': return pose({ sx: 1.14, sy: .42 });
    }
  } else if (part.type === 'eyebrow') {
    switch (emotion) {
      case 'thinking': return pose({ y: -5 });
      case 'happy': case 'affectionate': return pose({ y: -13, angle: -sign * 7 });
      case 'excited': case 'surprised': return pose({ y: -35, sx: 1.05 });
      case 'sad': return pose({ angle: -sign * 18, y: 8 });
      case 'angry': return pose({ angle: sign * 25, y: 15 });
      case 'shy': return pose({ angle: -sign * 10 });
      case 'confused': return pose({ y: left ? -28 : 10, angle: sign * 12 });
      case 'sleepy': return pose({ y: 13 });
      case 'playful': return pose({ y: left ? -12 : 3 });
    }
  } else if (part.type === 'mouth') {
    switch (emotion) {
      case 'thinking': return pose({ sx: .8, sy: .8 });
      case 'happy': return pose({ sx: 1.2, sy: 1.12 });
      case 'excited': return pose({ sx: 1.2, sy: 1.4 });
      case 'sad': return pose({ sx: .88, sy: -.82, y: 8 });
      case 'shy': return pose({ sx: .65, sy: .74 });
      case 'angry': return pose({ sx: 1.10, sy: -.95 });
      case 'confused': return pose({ angle: -12, sx: .82 });
      case 'sleepy': return pose({ sx: .6, sy: .65 });
      case 'surprised': return pose({ sx: .8, sy: 1.5 });
      case 'playful': return pose({ angle: -7, sx: 1.15 });
      case 'affectionate': return pose({ sx: 1.12, sy: .8 });
    }
  } else if (part.type === 'arm') {
    switch (emotion) {
      case 'excited': return pose({ angle: -sign * 8 });
      case 'happy': case 'affectionate': return pose({ angle: -sign * 4 });
      case 'playful': return pose({ angle: left ? -6 : 4 });
      case 'sad': case 'sleepy': return pose({ angle: sign * 3 });
    }
  } else if (part.type === 'leg') {
    if (emotion === 'excited' || emotion === 'playful') return pose({ angle: sign * 4 });
  }
  return { ...neutral };
}
