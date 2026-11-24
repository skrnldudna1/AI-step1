const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProfiles, validateProfile, greeting } = require('../persona.cjs');
const { createChatSession } = require('../chatSession.cjs');

test('each character has a distinct default profile and invalid saved values recover safely', () => {
  const defaults = normalizeProfiles(null);
  assert.equal(new Set(Object.values(defaults).map(profile => profile.name)).size, 4);
  const custom = { name: ' 토토 ', personality: 'focused', tone: 'polite' };
  const profiles = normalizeProfiles({ basic: custom, pomeranian: { name: '', personality: 'warm', tone: 'casual' } });
  assert.deepEqual(profiles.basic, { name: '토토', personality: 'focused', tone: 'polite' });
  assert.deepEqual(profiles.pomeranian, defaults.pomeranian);
  assert.deepEqual(profiles.illustration, defaults.illustration);
  assert.equal(validateProfile({ ...custom, name: 'x'.repeat(25) }), null);
  assert.equal(validateProfile({ ...custom, name: 'a\nb' }), null);
  assert.equal(validateProfile({ ...custom, personality: ['warm'] }), null);
  assert.equal(validateProfile({ ...custom, tone: 'unknown' }), null);
  assert.notEqual(greeting(defaults.basic), greeting(defaults.pomeranian));
});

test('a submitted message keeps its profile snapshot, even if the active character changes', async () => {
  let reply;
  let submittedProfile;
  const session = createChatSession({
    request: (_message, profile) => {
      submittedProfile = profile;
      return new Promise(resolve => { reply = resolve; });
    },
    publishChat() {},
    publishReaction() {},
  });
  const first = { name: '모모', personality: 'playful', tone: 'brief' };
  const second = { name: '코코', personality: 'calm', tone: 'polite' };
  try {
    session.setProfile(first);
    assert.equal(session.getChat().messages[0].senderName, first.name);
    assert.equal(session.getChat().messages[0].content, greeting(first));
    session.submit('안녕');
    assert.equal(session.getChat().pendingSenderName, first.name);
    session.setProfile(second);
    assert.deepEqual(submittedProfile, first);
    assert.equal(session.getChat().pendingSenderName, first.name);
    reply({ reply: '모모야!', reaction: { emotion: 'happy', action: 'nod', intensity: 0.5 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(session.getChat().messages.at(-1).senderName, first.name);
    assert.equal(session.getChat().pendingSenderName, null);
    session.submit('안녕');
    assert.deepEqual(submittedProfile, second);
    assert.equal(session.getChat().pendingSenderName, second.name);
  } finally {
    session.dispose();
  }
});
