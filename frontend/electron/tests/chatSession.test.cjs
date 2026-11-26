const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatSession } = require('../chatSession.cjs');

const flush = () => new Promise(resolve => setImmediate(resolve));

test('clear erases conversation and previous situation across profiles and accounts and stops animation', async () => {
  const received = [];
  let account = 'first';
  const session = createChatSession({
    contextKey: () => account,
    request: async (_message, _profile, history, previousSituation) => {
      received.push({ history, previousSituation });
      return { reply: '테스트 답변', situation: 'celebrating', reaction: { emotion: 'happy', intensity: .8, action: 'nod' } };
    },
    publishChat: () => {},
    publishReaction: () => {},
  });
  try {
    session.submit('첫 대화');
    assert.equal(session.clear(), false);
    await flush();
    account = 'second';
    session.submit('다른 계정 대화'); await flush();
    assert.equal(session.clear(), true);
    assert.equal(session.getChat().messages.length, 1);
    assert.equal(session.getReaction().isTalking, false);
    assert.deepEqual(session.getReaction().reaction, { emotion: 'neutral', intensity: .5, action: 'idle' });
    account = 'first';
    session.submit('새 대화'); await flush();
    assert.deepEqual(received[2], { history: [], previousSituation: undefined });
    account = 'second';
    session.submit('새로운 다른 대화'); await flush();
    assert.deepEqual(received[3], { history: [], previousSituation: undefined });
  } finally { session.dispose(); }
});

test('conversation situation follows recent turns but is isolated by account and character profile', async () => {
  const received = [];
  let account = 'chatgpt:one';
  const session = createChatSession({
    contextKey: () => account,
    request: async (message, profile, history, previousSituation) => {
      received.push({ message, history, previousSituation });
      const situation = message === '합격했어!' ? 'celebrating' : 'empathizing';
      return { reply: '잘했어', situation, reaction: { emotion: 'neutral', intensity: .5, action: 'idle' } };
    },
    publishChat: () => {},
    publishReaction: () => {},
  });
  try {
    for (const message of ['오늘 힘들었어', '응', '합격했어!', '고마워']) {
      session.submit(message); await flush();
    }
    assert.equal(received[1].previousSituation, 'empathizing');
    assert.equal(received[1].history[0].content, '오늘 힘들었어');
    assert.equal(received[3].previousSituation, 'celebrating');
    account = 'chatgpt:two';
    session.submit('안녕'); await flush();
    assert.equal(received[4].previousSituation, undefined);
    assert.deepEqual(received[4].history, []);
  } finally { session.dispose(); }
});

test('switching AI accounts does not forward another account’s conversation', async () => {
  let account = 'chatgpt:first';
  const received = [];
  const session = createChatSession({
    contextKey: () => account,
    request: async (_message, _profile, history) => {
      received.push(history);
      return { reply: 'reply', reaction: { emotion: 'neutral', intensity: .5, action: 'idle' } };
    },
    publishChat: () => {},
    publishReaction: () => {},
  });
  try {
    session.submit('private message');
    await flush();
    account = 'chatgpt:second';
    session.submit('second account message');
    await flush();
    assert.deepEqual(received[1], []);
    account = 'chatgpt:first';
    session.submit('first account again');
    await flush();
    assert.equal(received[2][0].content, 'private message');
  } finally { session.dispose(); }
});

test('successful conversation context is bounded and forwarded with the next message', async () => {
  const requests = [];
  const session = createChatSession({
    request: async (message, profile, history) => {
      requests.push({ message, history });
      return { reply: 'reply', reaction: { emotion: 'neutral', intensity: .5, action: 'idle' } };
    },
    publishChat: () => {},
    publishReaction: () => {},
  });
  try {
    for (let i = 0; i < 8; i++) {
      assert.equal(session.submit('message ' + i), true);
      await flush();
    }
    assert.deepEqual(requests[1].history, [{ role: 'user', content: 'message 0' }, { role: 'assistant', content: 'reply' }]);
    assert.equal(requests[7].history.length, 12);
    session.setProfile({ name: '다른 친구', personality: 'calm', tone: 'polite' });
    assert.equal(session.submit('hello'), true);
    await flush();
    assert.deepEqual(requests.at(-1).history, []);
  } finally {
    session.dispose();
  }
});

test('expressions return to neutral and default intensity, including repeated selections', async () => {
  const session = createChatSession({
    request: async () => {},
    publishChat: () => {},
    publishReaction: () => {},
    emotionResetMs: 30,
  });
  try {
    session.updateReaction({ emotion: 'happy', intensity: 0.9 });
    session.updateReaction({ emotion: 'happy' });
    assert.equal(session.getReaction().reactionId, 2);
    assert.equal(session.getReaction().reaction.emotion, 'happy');
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.deepEqual(session.getReaction().reaction, { emotion: 'neutral', intensity: 0.5, action: 'idle' });
  } finally {
    session.dispose();
  }
});

test('automatic neutral reset waits until the assistant finishes talking', async () => {
  const session = createChatSession({
    request: async () => ({ reply: 'Hi', reaction: { emotion: 'happy', intensity: 0.9, action: 'idle' } }),
    publishChat: () => {},
    publishReaction: () => {},
    emotionResetMs: 30,
  });
  try {
    session.submit('hello');
    await flush();
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(session.getReaction().isTalking, true);
    assert.equal(session.getReaction().reaction.emotion, 'happy');
    await new Promise(resolve => setTimeout(resolve, 1020));
    assert.equal(session.getReaction().isTalking, false);
    assert.equal(session.getReaction().reaction.emotion, 'neutral');
  } finally {
    session.dispose();
  }
});

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
