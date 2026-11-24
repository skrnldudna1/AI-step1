const test = require('node:test');
const assert = require('node:assert/strict');
const { getPopupBounds, getDetachedPopupBounds } = require('../popupBounds.cjs');
const area = { x: 0, y: 25, width: 1440, height: 875 };

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
