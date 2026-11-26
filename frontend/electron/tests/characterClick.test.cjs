const test = require('node:test');
const assert = require('node:assert/strict');

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test('single click opens mini chat once; double click opens settings without toggling chat', async () => {
  const { createCharacterClickHandler } = await import('../../src/characterClick.ts');
  const actions = [];
  const gesture = createCharacterClickHandler({ onSingle: () => actions.push('chat'), onDouble: () => actions.push('settings'), delay: 20 });
  try {
    gesture.click({ x: 100, y: 100 });
    assert.deepEqual(actions, []);
    await wait(40);
    assert.deepEqual(actions, ['chat']);
    gesture.click({ x: 100, y: 100 });
    gesture.click({ x: 103, y: 101 });
    assert.deepEqual(actions, ['chat', 'settings']);
    await wait(40);
    assert.deepEqual(actions, ['chat', 'settings']);
  } finally { gesture.cancel(); }
});

test('drag cancellation stops a queued click and distant clicks stay separate', async () => {
  const { createCharacterClickHandler } = await import('../../src/characterClick.ts');
  const actions = [];
  const gesture = createCharacterClickHandler({ onSingle: () => actions.push('chat'), onDouble: () => actions.push('settings'), delay: 20 });
  try {
    gesture.click({ x: 0, y: 0 });
    gesture.cancel();
    await wait(40);
    assert.deepEqual(actions, []);
    gesture.click({ x: 0, y: 0 });
    gesture.click({ x: 100, y: 100 });
    await wait(40);
    assert.deepEqual(actions, ['chat', 'chat']);
  } finally { gesture.cancel(); }
});
