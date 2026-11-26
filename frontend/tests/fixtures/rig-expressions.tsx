// Isolated development fixture; no user profiles or generated files are changed.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import RiggedCharacter from '../../src/components/Character/RiggedCharacter';
import { EMOTIONS, EMOTION_CONFIG } from '../../src/types/emotion';
import type { Emotion } from '../../src/types/emotion';
import type { CharacterRig, RigPart, RigRegion, RigRegionId } from '../../src/types/rig';
import type { Action } from '../../src/types/action';
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
const bustRig: CharacterRig = {
  id: 'bust-fixture', name: 'Bust Fixture', canvas: { width: 240, height: 320 }, expressions: {},
  parts: [
    part('base', 'body', 0, 0, 240, 320, svg('0 0 240 320',
      '<path d="M98 154 h44 v42 Q220 192 222 312 H18 Q20 192 98 196Z" fill="#bca9d2" stroke="#58443a" stroke-width="4"/><circle cx="120" cy="100" r="88" fill="#fff1e5" stroke="#58443a" stroke-width="4"/>')),
    part('left_eye', 'eyes', 74, 70, 22, 28, eye),
    part('right_eye', 'eyes', 146, 70, 22, 28, eye),
    part('left_eyebrow', 'eyebrow', 69, 57, 32, 10, brow),
    part('right_eyebrow', 'eyebrow', 141, 57, 32, 10, brow),
    part('mouth', 'mouth', 99, 129, 42, 20, svg('0 0 42 20', '<path d="M3 4Q21 28 39 4" fill="none" stroke="#4b3b3b" stroke-width="3" stroke-linecap="round"/>')),
  ],
};

function fullBodyRig(happy: boolean): CharacterRig {
  const head = svg('0 0 150 140', '<circle cx="75" cy="70" r="66" fill="#ffe7c4" stroke="#514637" stroke-width="3"/>' +
    (happy ? '<path d="M33 60Q44 40 55 60 M95 60Q106 40 117 60" stroke="#514637" stroke-width="4" fill="none"/><path d="M53 89Q75 121 97 89" fill="#b45855"/>' :
      '<ellipse cx="44" cy="60" rx="7" ry="10" fill="#514637"/><ellipse cx="106" cy="60" rx="7" ry="10" fill="#514637"/><path d="M56 92Q75 99 94 92" stroke="#514637" stroke-width="3" fill="none"/>'));
  const limb = (id: string, type: 'arm' | 'leg', x: number, y: number, w: number, h: number) =>
    ({ ...part(id, type, x, y, w, h, svg(`0 0 ${w} ${h}`, `<rect x="2" y="1" width="${w-4}" height="${h-3}" rx="12" fill="#8599a5" stroke="#514637" stroke-width="2"/>`)), pivotY: .12 });
  return {
    id: happy ? 'full-happy' : 'full-neutral', name: 'Full Fixture', canvas: { width: 240, height: 320 }, preserveFace: true, partLayoutVersion: 2, expressions: {},
    parts: [
      part('torso','body',70,135,100,97,svg('0 0 100 97','<rect x="1" y="1" width="98" height="95" rx="23" fill="#92b8a0" stroke="#514637" stroke-width="3"/>')),
      limb('left_arm','arm',37,147,43,79), limb('right_arm','arm',160,147,43,79),
      limb('left_leg','leg',80,225,37,88), limb('right_leg','leg',123,225,37,88),
      { ...part('head','head',45,8,150,140,head), pivotY: .93, zIndex: 10 },
    ],
  };
}
const preservedRig = fullBodyRig(false);
preservedRig.expressionRigs = { happy: fullBodyRig(true) };
const meshRegion = (id: RigRegionId, x: number, y: number, w: number, h: number, px = x+w/2, py = y+h/2): RigRegion => ({
  id, mode: 'region', points: [{x:x/240,y:y/320}, {x:(x+w)/240,y:y/320}, {x:(x+w)/240,y:(y+h)/320}, {x:x/240,y:(y+h)/320}], pivot: {x:px/240,y:py/320},
});
const meshRig: CharacterRig = {
  ...preservedRig, id: 'mesh-fixture', expressionRigs: undefined,
  mesh: {
    src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320"><g stroke="#514637" stroke-width="3"><rect x="80" y="204" width="35" height="102" rx="15" fill="#8599a5"/><rect x="125" y="204" width="35" height="102" rx="15" fill="#8599a5"/><rect x="37" y="137" width="44" height="82" rx="20" fill="#8599a5"/><rect x="159" y="137" width="44" height="82" rx="20" fill="#8599a5"/><rect x="64" y="128" width="112" height="102" rx="30" fill="#92b8a0"/><circle cx="120" cy="80" r="68" fill="#ffe7c4"/><path d="M74 59q10 -7 20 -2 M146 57q10 -5 20 2" fill="none" stroke-width="5" stroke-linecap="round"/><ellipse cx="85" cy="78" rx="7" ry="10" fill="#514637"/><ellipse cx="155" cy="78" rx="7" ry="10" fill="#514637"/><path d="M101 107q19 9 38 0" fill="none" stroke-width="5" stroke-linecap="round"/></g></svg>'),
    regions: [meshRegion('head',50,10,140,140,120,143),meshRegion('left_eye',76,66,18,24),meshRegion('right_eye',146,66,18,24),meshRegion('left_eyebrow',72,49,25,16),meshRegion('right_eyebrow',143,49,25,16),meshRegion('mouth',97,103,46,16),meshRegion('left_arm',36,138,44,82,75,148),meshRegion('right_arm',159,138,44,82,165,148),meshRegion('left_leg',80,219,35,89,97,221),meshRegion('right_leg',125,219,35,89,142,221)],
  },
};
const neutralSVG = decodeURIComponent(meshRig.mesh!.src.slice('data:image/svg+xml,'.length));
const happySVG = neutralSVG.replace('<ellipse cx="85" cy="78" rx="7" ry="10" fill="#514637"/><ellipse cx="155" cy="78" rx="7" ry="10" fill="#514637"/>', '<path d="M75 80Q85 66 95 80 M145 80Q155 66 165 80" fill="none" stroke-width="5" stroke-linecap="round"/>')
  .replace('<path d="M101 107q19 9 38 0" fill="none" stroke-width="5" stroke-linecap="round"/>','<path d="M97 101Q120 133 143 101Z" fill="#cf675b"/>');
meshRig.expressionRigs = { happy: { ...meshRig, id: 'mesh-happy-fixture', mesh: { ...meshRig.mesh!, src: 'data:image/svg+xml,' + encodeURIComponent(happySVG) } } };

function Fixture() {
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [reactionId, setReactionId] = useState(0);
  const [bust, setBust] = useState(false);
  const [fullBody, setFullBody] = useState(false);
  const [useMesh, setUseMesh] = useState(true);
  const [action, setAction] = useState<Action>('idle');
  return <main style={{ padding: 24, maxWidth: 680, margin: 'auto' }}>
    <h1>Custom rig expression test</h1>
    <div style={{ height: 300, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: useMesh || bust || fullBody ? 210 : 250 }}><RiggedCharacter rig={useMesh ? meshRig : fullBody ? preservedRig : bust ? bustRig : rig} reaction={{ emotion, intensity: .7, action }} reactionId={reactionId} /></div>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
      <button type="button" onClick={() => { setUseMesh(false); setFullBody(false); setBust(value => !value); }}>{bust ? '얼굴만 있는 샘플' : '머리·몸 샘플'}</button>
      <button type="button" onClick={() => { setUseMesh(false); setFullBody(value => !value); }}>원본 얼굴·팔다리 샘플</button>
      <button type="button" onClick={() => setUseMesh(true)}>메시 리깅 샘플</button>
      {(['idle','nod','shake','bounce'] as Action[]).map(value =>
        <button key={value} type="button" onClick={() => { setAction(value); setReactionId(prev => prev + 1); }}>{value}</button>
      )}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {EMOTIONS.map(value => <button key={value} type="button" aria-pressed={value === emotion}
        onClick={() => { setEmotion(value); setReactionId(prev => prev + 1); }}>{EMOTION_CONFIG[value].label}</button>)}
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
