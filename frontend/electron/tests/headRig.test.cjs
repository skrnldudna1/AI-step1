const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = () => import('../../src/headRig.ts');

function part(id, type, x, y, width, height) {
  return { id, type, x, y, width, height, src: id + '.png', pivotX: .5, pivotY: .5, zIndex: 1 };
}
const bustRig = {
  canvas: { width: 400, height: 500 },
  parts: [
    part('base','body',0,0,400,500),
    part('left_eye','eyes',145,125,28,24), part('right_eye','eyes',225,125,28,24),
    part('mouth','mouth',184,188,34,22),
  ],
};

test('head and body polygons overlap only around the neck; hit areas track the real visible layer', async () => {
  const { horizontalSplit, pointInPolygon, POM_HEAD_CLIP, POM_BODY_CLIP, clipPath } = await helpers();
  const masks = horizontalSplit(70, 6);
  assert.equal(pointInPolygon(50, 20, masks.head), true);
  assert.equal(pointInPolygon(50, 20, masks.body), false);
  assert.equal(pointInPolygon(50, 90, masks.head), false);
  assert.equal(pointInPolygon(50, 90, masks.body), true);
  assert.equal(pointInPolygon(50, 67, masks.head), true);
  assert.equal(pointInPolygon(50, 67, masks.body), true);
  assert.equal(pointInPolygon(50, 10, POM_BODY_CLIP), false);
  assert.equal(pointInPolygon(50, 90, POM_HEAD_CLIP), false);
  assert.match(clipPath(masks.head), /^polygon\(/);
});

test('bust rigs can estimate a neck and users can override it safely', async () => {
  const { getRigHeadPlan, getRigSplitRange, isHeadPart } = await helpers();
  const auto = getRigHeadPlan(bustRig);
  assert.equal(auto.mode, 'clipped');
  assert.ok(auto.neckY > 42 && auto.neckY < 65);
  assert.equal(isHeadPart(bustRig.parts[0], auto, 500), false);
  assert.equal(isHeadPart(bustRig.parts[1], auto, 500), true);
  const manual = getRigHeadPlan({ ...bustRig, headSplit: 68 });
  assert.equal(manual.neckY, 68);
  assert.equal(getRigHeadPlan({ ...bustRig, headSplit: 0 }).neckY, getRigSplitRange(bustRig).min);
});

test('existing independently separated heads take priority and single-face avatars stay whole', async () => {
  const { getRigHeadPlan } = await helpers();
  const explicit = { ...bustRig, parts: [...bustRig.parts, part('head','head',100,10,200,250)] };
  assert.equal(getRigHeadPlan(explicit).mode, 'separate');
  assert.equal(getRigHeadPlan(explicit).pivotX, 50);
  const edited = { ...explicit, partLayoutVersion: 2,
    parts: explicit.parts.map(p => p.id === 'head' ? { ...p, pivotX: .25, pivotY: .8 } : p) };
  assert.equal(getRigHeadPlan(edited).pivotX, 37.5);
  assert.equal(getRigHeadPlan(edited).pivotY, 42);
  const faceOnly = { canvas: {width:240,height:240}, parts: [
    part('base','body',0,0,240,240),
    part('left_eye','eyes',74,88,22,28), part('right_eye','eyes',146,88,22,28),
    part('mouth','mouth',99,145,42,20),
  ]};
  assert.equal(getRigHeadPlan(faceOnly).mode, 'whole');
  assert.equal(getRigHeadPlan({ ...faceOnly, headSplit: 80 }).mode, 'clipped');
});
