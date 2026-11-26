const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeContextualReaction, expressionInstructions, SITUATIONS } = require('../conversationExpression.cjs');
const { parseReaction } = require('../chatgptConnection.cjs');
const emotionConfig = require('../emotionConfig.json');

test('every conversational situation has valid linked expressions and a safe default', () => {
  const validActions = ['idle', 'nod', 'shake', 'bounce'];
  for (const [situation, rule] of Object.entries(SITUATIONS)) {
    assert.ok(rule.emotions.every(emotion => Object.hasOwn(emotionConfig, emotion)));
    assert.ok(rule.actions.every(action => validActions.includes(action)));
    assert.ok(rule.emotions.includes(rule.fallback));
    assert.ok(rule.intensity <= rule.max);
    for (const emotion of Object.keys(emotionConfig)) {
      const result = normalizeContextualReaction(situation, { emotion, intensity: 1, action: 'bounce' });
      assert.ok(rule.emotions.includes(result.emotion));
      assert.ok(result.intensity <= rule.max);
      assert.ok(rule.actions.includes(result.action));
    }
  }
});

test('an excited response is not used for comfort or information, but is preserved for celebration', () => {
  const proposal = { emotion: 'excited', intensity: .95, action: 'bounce' };
  assert.deepEqual(normalizeContextualReaction('empathizing', proposal), { emotion: 'sad', intensity: .55, action: 'idle' });
  assert.deepEqual(normalizeContextualReaction('explaining', proposal), { emotion: 'neutral', intensity: .5, action: 'idle' });
  assert.deepEqual(normalizeContextualReaction('celebrating', proposal), { emotion: 'excited', intensity: .9, action: 'bounce' });
  assert.equal(normalizeContextualReaction('invalid', proposal), null);
});

test('the meaning of a sad or funny situation wins over generic happy/neutral model suggestions', () => {
  const sad = parseReaction(JSON.stringify({ reply:'많이 마음이 아프겠다. 네 곁에서 이야기 들어 줄게.', situation:'empathizing', reaction:{emotion:'affectionate',intensity:.8,action:'nod'} }));
  const funny = parseReaction(JSON.stringify({ reply:'팀장님 대신 야옹으로 회의를 진행했다고?!', situation:'playing', reaction:{emotion:'neutral',intensity:.5,action:'idle'} }));
  assert.equal(sad.reaction.emotion,'sad');
  assert.equal(funny.reaction.emotion,'playful');
  assert.match(expressionInstructions('empathizing'), /사건과 상대가 느낄 만한 분위기/);
  assert.match(expressionInstructions(), /무지개다리/);
});

test('the situation is required and applied to the AI reply before publishing', () => {
  const response = { reply: '괜찮아, 천천히 해 보자.', situation: 'reassuring', reaction: { emotion: 'angry', intensity: .9, action: 'shake' } };
  assert.deepEqual(parseReaction(JSON.stringify(response)), { reply: response.reply, situation: 'reassuring', reaction: { emotion: 'affectionate', intensity: .5, action: 'idle' } });
  assert.throws(() => parseReaction(JSON.stringify({ ...response, situation: 'unknown' })), /대화 상황/);
  assert.match(expressionInstructions('empathizing'), /직전 실제 답변의 상황은 empathizing/);
});
