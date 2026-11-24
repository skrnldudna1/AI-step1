const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatSession } = require('../chatSession.cjs');

const flush = () => new Promise(resolve => setImmediate(resolve));

test('both chat windows share one request, history and character reaction', async () => {
  let resolveResponse;
  let requests = 0;
  const chatUpdates = [];
  const reactionUpdates = [];
  const session = createChatSession({
    request: () => {
      requests++;
      return new Promise(resolve => { resolveResponse = resolve; });
    },
    publishChat: state => chatUpdates.push(state),
    publishReaction: state => reactionUpdates.push(state),
  });
  try {
    assert.equal(session.getChat().messages.length, 1);
    assert.equal(session.submit('   '), false);
    assert.equal(session.submit('x'.repeat(4001)), false);
    assert.equal(session.submit('첫 번째 질문'), true);
    assert.equal(session.submit('중복 요청'), false);
    assert.equal(requests, 1);
    assert.equal(session.getChat().isLoading, true);
    assert.equal(session.getReaction().isThinking, true);
    assert.equal(chatUpdates.at(-1).messages.at(-1).content, '첫 번째 질문');

    resolveResponse({
      reply: '안녕!',
      reaction: { emotion: 'happy', action: 'bounce', intensity: 0.9 },
    });
    await flush();
    assert.deepEqual(session.getChat().messages.map(m => m.role), ['assistant', 'user', 'assistant']);
    assert.equal(session.getChat().messages.at(-1).content, '안녕!');
    assert.equal(session.getChat().isLoading, false);
    assert.equal(reactionUpdates.at(-1).isThinking, false);
    assert.equal(session.getReaction().isTalking, true);
    assert.equal(session.getReaction().reaction.emotion, 'happy');
    assert.equal(session.getReaction().reactionId, 1);
    session.updateReaction({ emotion: 'sad', intensity: 2 });
    assert.equal(session.getReaction().reaction.emotion, 'sad');
    assert.equal(session.getReaction().reaction.intensity, 1);
    assert.equal(session.getReaction().isTalking, true);
    assert.equal(session.getReaction().reactionId, 2);
    session.updateReaction({ action: 'nod' });
    assert.equal(session.getReaction().reactionId, 3);
    await new Promise(resolve => setTimeout(resolve, 1050));
    assert.equal(session.getReaction().reaction.action, 'idle');
    assert.equal(session.getReaction().isTalking, false);
  } finally {
    session.dispose();
  }
});

test('request errors are shared and the next message can be sent', async () => {
  const session = createChatSession({
    request: async () => { throw new Error('test offline'); },
    publishChat: () => {},
    publishReaction: () => {},
  });
  try {
    assert.equal(session.submit('테스트'), true);
    await flush();
    assert.equal(session.getChat().isLoading, false);
    assert.equal(session.getReaction().isThinking, false);
    assert.match(session.getChat().messages.at(-1).content, /서버 연결/);
    assert.equal(session.submit('다시 시도'), true);
    await flush();
    assert.equal(session.getChat().messages.length, 5);
  } finally {
    session.dispose();
  }
});
