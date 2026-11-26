const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRigImages, parseRigAnalysis, rigVisionInput } = require('../rigVision.cjs');

test('vision inference sends primary and reference images distinctly and accepts only valid bounded polygons', () => {
  const images = ['data:image/png;base64,AAAA', 'data:image/jpeg;base64,BBBB'];
  assert.equal(validateRigImages(images), true);
  assert.equal(validateRigImages(['file:///secret.png']), false);
  assert.equal(validateRigImages(Array(6).fill(images[0])), false);
  const content = rigVisionInput(images)[0].content;
  assert.deepEqual(content.filter(x => x.type === 'input_image').map(x => x.image_url), images);
  assert.match(content[1].text, /대표/);
  const region = { id: 'head', points: [{ x: .1, y: .1 }, { x: .8, y: .1 }, { x: .8, y: .5 }, { x: .1, y: .5 }], pivot: { x: .5, y: .45 } };
  const parsed = parseRigAnalysis(JSON.stringify({ parts: [region, region, { ...region, id: 'left_arm', pivot: { x: 2, y: 0 } }, { ...region, id: 'bad' }] }));
  assert.deepEqual(parsed, [{ ...region, mode: 'region' }]);
});

test('manual polygons move and keep joint centers within the image', async () => {
  const { rectanglePoints, moveRegion, pivotForRegion, polygonArea } = await import('../../src/rigRegions.ts');
  const points = rectanglePoints({ x: .2, y: .3 }, { x: .5, y: .7 });
  const region = { id: 'left_arm', points, pivot: pivotForRegion('left_arm', points), mode: 'region' };
  assert.ok(region.pivot.y < .4);
  assert.ok(polygonArea(points) > 0);
  const moved = moveRegion(region, 10, -10);
  assert.equal(Math.max(...moved.points.map(p => p.x)), 1);
  assert.equal(Math.min(...moved.points.map(p => p.y)), 0);
  assert.ok(moved.pivot.y >= 0);
});
