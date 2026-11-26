const test = require('node:test');
const assert = require('node:assert/strict');
const { getPopupBounds, getDetachedPopupBounds, resizePopupBounds, normalizePopupSize } = require('../popupBounds.cjs');
const area = { x: 0, y: 25, width: 1440, height: 875 };

test('edge and corner resizing anchors the opposite edge, supports custom dimensions, and clamps to the screen', () => {
  const initial = { x: 400, y: 250, width: 360, height: 420 };
  assert.deepEqual(resizePopupBounds(initial, 'se', 200, 80, area), { x: 400, y: 250, width: 560, height: 500 });
  assert.deepEqual(resizePopupBounds(initial, 'nw', -100, -75, area), { x: 300, y: 175, width: 460, height: 495 });
  assert.deepEqual(resizePopupBounds(initial, 'e', -500, 70, area), { x: 400, y: 250, width: 300, height: 420 });
  assert.deepEqual(resizePopupBounds(initial, 's', 70, -500, area), { x: 400, y: 250, width: 360, height: 340 });
  assert.deepEqual(resizePopupBounds(initial, 'nw', -2000, -2000, area), { x: 0, y: 25, width: 760, height: 645 });
  assert.deepEqual(resizePopupBounds(initial, 'se', 2000, 2000, area), { x: 400, y: 250, width: 1040, height: 650 });
  assert.deepEqual(getDetachedPopupBounds({ x: 1200, y: 800 }, area, { width: 600, height: 500 }), { x: 840, y: 400, width: 600, height: 500 });
  assert.deepEqual(getPopupBounds({ x: 100, y: 200, width: 360, height: 400 }, area, { width: 600, height: 500 }), { x: 468, y: 150, width: 600, height: 500 });
  assert.deepEqual(normalizePopupSize({ width: NaN, height: 200 }), { width: 360, height: 420 });
});

test('popup prefers right, then left, with 8px gap', () => {
  const pet = { x: 100, y: 200, width: 360, height: 400 };
  assert.deepEqual(getPopupBounds(pet, area), { x: 468, y: 190, width: 360, height: 420 });
  assert.deepEqual(getPopupBounds({ ...pet, x: 1000 }, area), { x: 632, y: 190, width: 360, height: 420 });
});

test('independent popup position stays unchanged unless outside the display', () => {
  assert.deepEqual(getDetachedPopupBounds({ x: 400, y: 300 }, area), {
    x: 400, y: 300, width: 360, height: 420,
  });
  assert.deepEqual(getDetachedPopupBounds({ x: 9999, y: -1 }, area), {
    x: 1080, y: 25, width: 360, height: 420,
  });
  assert.deepEqual(getDetachedPopupBounds({ x: -2000, y: 999 }, { x: -900, y: 25, width: 300, height: 250 }), {
    x: -900, y: 25, width: 300, height: 250,
  });
});

test('popup uses below or above when neither side fits', () => {
  const pet = { x: 200, y: 50, width: 1040, height: 350 };
  assert.deepEqual(getPopupBounds(pet, area), { x: 540, y: 408, width: 360, height: 420 });
  assert.deepEqual(getPopupBounds({ ...pet, y: 500 }, area), { x: 540, y: 72, width: 360, height: 420 });
});

test('popup stays inside the current screen on small or offset displays', () => {
  const workArea = { x: -900, y: 30, width: 800, height: 500 };
  const pet = { x: -850, y: 50, width: 720, height: 800 };
  const bounds = getPopupBounds(pet, workArea);
  assert.ok(bounds.x >= workArea.x && bounds.x + bounds.width <= workArea.x + workArea.width);
  assert.ok(bounds.y >= workArea.y && bounds.y + bounds.height <= workArea.y + workArea.height);
  const tiny = getPopupBounds(pet, { x: -300, y: 50, width: 250, height: 200 });
  assert.deepEqual(tiny, { x: -300, y: 50, width: 250, height: 200 });
});
