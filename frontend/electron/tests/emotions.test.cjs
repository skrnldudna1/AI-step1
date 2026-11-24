const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../emotionConfig.json');
const { createChatSession } = require('../chatSession.cjs');

test('all eleven emotions have an existing, distinct illustration sprite and valid rig fallback', () => {
  assert.equal(Object.keys(config).length, 11);
  assert.equal(new Set(Object.values(config).map(entry => entry.illustration)).size, 11);
  for (const entry of Object.values(config)) {
    assert.ok(fs.existsSync(path.join(__dirname, '../../public/character', entry.illustration)));
    assert.ok(config[entry.fallback]);
  }
});

test('all eleven emotions are accepted for manual tests and AI responses', async () => {
  let emotion = 'neutral';
  const session = createChatSession({
    request: async () => ({ reply: 'test', reaction: { emotion, action: 'idle', intensity: .8 } }),
    publishChat() {},
    publishReaction() {},
  });
  try {
    for (emotion of Object.keys(config)) {
      session.updateReaction({ emotion });
      assert.equal(session.getReaction().reaction.emotion, emotion);
      assert.equal(session.submit('emotion test'), true);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(session.getReaction().reaction.emotion, emotion);
      assert.equal(session.getReaction().isTalking, true);
    }
    session.updateReaction({ emotion: 'unknown' });
    assert.equal(session.getReaction().reaction.emotion, 'affectionate');
  } finally { session.dispose(); }
});

test('old custom rigs get distinct eye and mouth poses without new asset files', async () => {
  const { getRigExpressionPose } = await import('../../src/components/Character/rigExpressionPose.ts');
  const eye = { id: 'left_eye', type: 'eyes', x: 10, width: 10 };
  const rightEye = { ...eye, id: 'right_eye', x: 70 };
  const mouth = { id: 'mouth', type: 'mouth', x: 42, width: 16 };
  assert.equal(getRigExpressionPose(eye, 'neutral', 100).sy, 1);
  assert.equal(getRigExpressionPose(eye, 'thinking', 100).sy, getRigExpressionPose(rightEye, 'thinking', 100).sy);
  assert.equal(getRigExpressionPose(eye, 'thinking', 100).angle, 0);
  assert.ok(getRigExpressionPose(eye, 'thinking', 100).sy > .8);
  assert.equal(getRigExpressionPose(eye, 'sleepy', 100).sy, .18);
  assert.equal(getRigExpressionPose(rightEye, 'playful', 100).sy, .1);
  assert.equal(getRigExpressionPose(eye, 'playful', 100).sy, 1);
  assert.notEqual(getRigExpressionPose(eye, 'angry', 100).angle, getRigExpressionPose(rightEye, 'angry', 100).angle);
  assert.ok(getRigExpressionPose(mouth, 'surprised', 100).sy > 1);
  assert.ok(getRigExpressionPose(mouth, 'sad', 100).sy < 0);
  for (const emotion of Object.keys(config)) {
    for (const part of [eye, rightEye, mouth]) {
      const pose = getRigExpressionPose(part, emotion, 100);
      assert.ok(Object.values(pose).every(Number.isFinite));
    }
  }
});
