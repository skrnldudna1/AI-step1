const test = require('node:test');
const assert = require('node:assert/strict');
const api = () => import('../../src/components/Character/meshDeformation.ts');

function region(id, x0, y0, x1, y1, pivot = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }) {
  return { id, mode: 'region', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], pivot };
}
const regions = [region('head', .15, .05, .85, .52, { x: .5, y: .52 }), region('left_eye', .32, .23, .40, .30), region('mouth', .42, .36, .58, .40), region('left_arm', .15, .58, .30, .76, { x: .29, y: .59 }), region('right_leg', .57, .78, .68, .96, { x: .62, y: .78 })];
const reaction = { emotion: 'happy', intensity: 1, action: 'idle' };

test('neutral mesh retains every original coordinate and all triangles share vertices', async () => {
  const { createRigMesh, deformRigMesh, neutralMeshPose } = await api();
  const mesh = createRigMesh(regions, .8, 100);
  const result = new Float32Array(mesh.vertices.length);
  assert.equal(mesh.indices.length, 100 * 100 * 6);
  assert.deepEqual(deformRigMesh(mesh, mesh.controls.map(neutralMeshPose), result), mesh.vertices);
});

test('face expression moves eye and mouth but leaves unrelated limbs untouched', async () => {
  const { createRigMesh, deformRigMesh, meshMotion } = await api();
  const mesh = createRigMesh(regions, .8, 100);
  const poses = mesh.controls.map(control => meshMotion(control, 'happy', reaction, 1, false, true));
  const result = deformRigMesh(mesh, poses, new Float32Array(mesh.vertices.length));
  const coords = (x, y) => 2 * (y * 101 + x);
  assert.notEqual(result[coords(36, 24) + 1], mesh.vertices[coords(36, 24) + 1]);
  assert.notEqual(result[coords(44, 38) + 1], mesh.vertices[coords(44, 38) + 1]);
  assert.equal(result[coords(20, 70)], mesh.vertices[coords(20, 70)]);
  assert.equal(result[coords(65, 90) + 1], mesh.vertices[coords(65, 90) + 1]);
  assert.ok(result.every(Number.isFinite));
});

test('reaction motions affect only the intended mesh regions; nod returns to neutral', async () => {
  const { createRigMesh, meshMotion } = await api();
  const mesh = createRigMesh(regions, 1);
  const head = mesh.controls.find(control => control.region.id === 'head');
  const arm = mesh.controls.find(control => control.region.id === 'left_arm');
  const leg = mesh.controls.find(control => control.region.id === 'right_leg');
  assert.ok(meshMotion(head, 'neutral', { ...reaction, action: 'nod' }, .4, false, false).sy < 1);
  assert.equal(meshMotion(head, 'neutral', { ...reaction, action: 'nod' }, 2, false, false).sy, 1);
  assert.equal(meshMotion(leg, 'neutral', reaction, .4, true, false).angle, 0);
  assert.notEqual(meshMotion(arm, 'neutral', reaction, .4, true, false).angle, 0);
  assert.notEqual(meshMotion(leg, 'excited', { ...reaction, action: 'bounce' }, .4, false, false).angle, 0);
});

test('even extreme overlapping motion cannot invert texture triangles', async () => {
  const { createRigMesh, deformRigMesh, neutralMeshPose } = await api();
  const mesh = createRigMesh([region('left_eye', .43,.25,.47,.28), region('left_eyebrow', .43,.20,.47,.25)], 1);
  const out = deformRigMesh(mesh, mesh.controls.map(() => ({ ...neutralMeshPose(), y: .23, sx: 1.8, sy: .05 })), new Float32Array(mesh.vertices.length));
  for (let i=0;i<mesh.indices.length;i+=3) {
    const [a,b,c] = Array.from(mesh.indices.subarray(i,i+3), n=>n*2);
    assert.ok((out[b]-out[a])*(out[c+1]-out[a+1])-(out[b+1]-out[a+1])*(out[c]-out[a]) > 0);
  }
});

test('default-strength faces clearly distinguish squint, surprise, frown and smile, including thin line art', async () => {
  const { createRigMesh, meshMotion } = await api();
  const mesh = createRigMesh([region('left_eye', .32,.23,.40,.30), region('left_eyebrow', .31,.18,.41,.19), region('mouth', .42,.36,.58,.37)], 1);
  const [eye, brow, mouth] = mesh.controls;
  const defaultReaction = { ...reaction, intensity: .5 };
  const pose = (control, emotion) => meshMotion(control, emotion, defaultReaction, 1, false, true);
  assert.ok(pose(eye,'happy').sy < .5);
  assert.ok(pose(eye,'surprised').sy > 1.4);
  assert.ok(pose(brow,'angry').angle > .25);
  assert.ok(pose(brow,'sad').angle < -.25);
  assert.ok(pose(mouth,'happy').smile < -.025);
  assert.ok(pose(mouth,'sad').smile > .025);
});

test('a restricted joint does not attenuate an unrelated facial expression', async () => {
  const { createRigMesh, deformRigMesh, neutralMeshPose, meshMotion } = await api();
  const mesh = createRigMesh([regions[1], regions[3]], 1, 100);
  const [eye, arm] = mesh.controls;
  const eyePose = meshMotion(eye,'happy',reaction,1,false,true);
  const first = deformRigMesh(mesh,[eyePose,neutralMeshPose()],new Float32Array(mesh.vertices.length));
  const second = deformRigMesh(mesh,[eyePose,{...neutralMeshPose(),angle: 2.8}],new Float32Array(mesh.vertices.length));
  for (const i of eye.affected) if (!arm.weight[i]) {
    assert.equal(first[i*2], second[i*2]);
    assert.equal(first[i*2+1], second[i*2+1]);
  }
});
