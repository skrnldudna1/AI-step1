// Isolated development fixture; no user profiles or generated files are changed.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import RiggedCharacter from '../../src/components/Character/RiggedCharacter';
import { EMOTIONS, EMOTION_CONFIG } from '../../src/types/emotion';
import type { Emotion } from '../../src/types/emotion';
import type { CharacterRig, RigPart } from '../../src/types/rig';
import '../../src/index.css';

const svg = (viewBox: string, content: string) => 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`
);
function part(id: string, type: RigPart['type'], x: number, y: number, width: number, height: number, src: string): RigPart {
  return { id, type, x, y, width, height, src, pivotX: .5, pivotY: .5, zIndex: type === 'body' ? 0 : 1 };
}
const eye = svg('0 0 22 28', '<ellipse cx="11" cy="14" rx="8" ry="11" fill="#4b3b3b"/>');
const brow = svg('0 0 32 10', '<path d="M3 7Q16 2 29 7" fill="none" stroke="#4b3b3b" stroke-width="4" stroke-linecap="round"/>');
const rig: CharacterRig = {
  id: 'fixture', name: 'Fixture', canvas: { width: 240, height: 240 }, expressions: {},
  parts: [
    part('base', 'body', 0, 0, 240, 240, svg('0 0 240 240', '<circle cx="120" cy="120" r="111" fill="#fff1e5" stroke="#58443a" stroke-width="4"/>')),
    part('left_eye', 'eyes', 74, 88, 22, 28, eye),
    part('right_eye', 'eyes', 146, 88, 22, 28, eye),
    part('left_eyebrow', 'eyebrow', 69, 73, 32, 10, brow),
    part('right_eyebrow', 'eyebrow', 141, 73, 32, 10, brow),
    part('mouth', 'mouth', 99, 145, 42, 20, svg('0 0 42 20', '<path d="M3 4Q21 28 39 4" fill="none" stroke="#4b3b3b" stroke-width="3" stroke-linecap="round"/>')),
  ],
};

function Fixture() {
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [reactionId, setReactionId] = useState(0);
  return <main style={{ padding: 24, maxWidth: 680, margin: 'auto' }}>
    <h1>Custom rig expression test</h1>
    <div style={{ height: 300, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 250 }}><RiggedCharacter rig={rig} reaction={{ emotion, intensity: .7, action: 'idle' }} reactionId={reactionId} /></div>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {EMOTIONS.map(value => <button key={value} type="button" aria-pressed={value === emotion}
        onClick={() => { setEmotion(value); setReactionId(prev => prev + 1); }}>{EMOTION_CONFIG[value].label}</button>)}
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
