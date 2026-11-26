const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createChatGPTConnection, validateIdentity, readResponseStream } = require('../chatgptConnection.cjs');

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const CLIENT_ID = 'oaiapp_test123';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256' };
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');

function identity(nonce, overrides = {}) {
  const header = encode({ alg: 'RS256', kid: 'test-key' });
  const payload = encode({ iss: ISSUER, aud: CLIENT_ID, sub: 'test-subject', email: 'test@example.test', nonce,
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3600, ...overrides });
  return header + '.' + payload + '.' + crypto.sign('RSA-SHA256', Buffer.from(header + '.' + payload), privateKey).toString('base64url');
}

function events(...frames) {
  return new Response(frames.map(event => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join(''), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('ID tokens must have a verified signature, client, issuer, expiry and matching nonce', async () => {
  const fetcher = async () => jsonResponse({ keys: [jwk] });
  const jwt = identity('nonce');
  assert.equal((await validateIdentity(jwt, CLIENT_ID, 'nonce', fetcher)).sub, 'test-subject');
  await assert.rejects(validateIdentity(jwt, CLIENT_ID, 'different', fetcher));
  await assert.rejects(validateIdentity(jwt, 'oaiapp_other', 'nonce', fetcher));
  await assert.rejects(validateIdentity(identity('nonce', { exp: 1 }), CLIENT_ID, 'nonce', fetcher));
  const [head, body, signature] = jwt.split('.');
  const tampered = head + '.' + encode({ ...JSON.parse(Buffer.from(body, 'base64url')), sub: 'wrong' }) + '.' + signature;
  await assert.rejects(validateIdentity(tampered, CLIENT_ID, 'nonce', fetcher));
});

test('Responses stream requires completion, validates reactions and surfaces subscription limits', async () => {
  const result = { reply: '오늘도 반가워!', situation: 'casual', reaction: { emotion: 'happy', intensity: .6, action: 'nod' } };
  const text = JSON.stringify(result);
  assert.deepEqual(await readResponseStream(events(
    { type: 'response.output_text.delta', delta: text.slice(0, 15) },
    { type: 'response.output_text.delta', delta: text.slice(15) },
    { type: 'response.completed' },
  )), result);
  await assert.rejects(readResponseStream(events({ type: 'response.output_text.delta', delta: text })), /중간에 끊겼/);
  await assert.rejects(readResponseStream(events({ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } })), /사용 한도/);
  await assert.rejects(readResponseStream(events({ type: 'response.output_text.delta', delta: JSON.stringify({ ...result, reaction: { ...result.reaction, intensity: 2 } }) }, { type: 'response.completed' })), /형식/);
});

test('local registration, code exchange, model listing, inference and signout use the correct paths and never expose tokens to the UI', async () => {
  let saved, authorization, callback, closed = false;
  let exchangeCount = 0, revocationCount = 0, inferenceCount = 0, refreshCount = 0, visionCount = 0;
  const states = [];
  const connector = createChatGPTConnection({
    store: { load: () => saved, save: value => { saved = structuredClone(value); } },
    openBrowser: async url => { authorization = new URL(url); },
    publish: state => states.push(state),
    createServer: handler => {
      callback = handler;
      return { once() {}, listen(_port, host, done) { assert.equal(host, '127.0.0.1'); done(); }, address: () => ({ port: 54321 }), close() { closed = true; } };
    },
    fetcher: async (url, options) => {
      if (url === ISSUER + '/.well-known/jwks.json') return jsonResponse({ keys: [jwk] });
      if (url === ISSUER + '/api/accounts/oauth/token') {
        if (options.body.get('grant_type') === 'refresh_token') {
          refreshCount++;
          assert.equal(options.body.get('client_id'), CLIENT_ID);
          assert.equal(options.body.get('refresh_token'), 'test-refresh');
          return jsonResponse({ access_token: 'test-access-2', refresh_token: 'test-refresh-2', expires_in: 3600, scope: SCOPES, token_type: 'Bearer' });
        }
        exchangeCount++;
        assert.equal(options.body.get('client_id'), CLIENT_ID);
        assert.equal(options.body.get('redirect_uri'), authorization.searchParams.get('redirect_uri'));
        assert.equal(crypto.createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'), authorization.searchParams.get('code_challenge'));
        return jsonResponse({ id_token: identity(authorization.searchParams.get('nonce')), access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 1, scope: SCOPES, token_type: 'Bearer' });
      }
      if (url === RESOURCE + '/models') {
        assert.equal(options.headers.Authorization, 'Bearer test-access-2');
        return jsonResponse({ models: [
          { slug: 'gpt-6.2-sol', display_name: 'GPT', visibility: 'list' },
          { slug: 'hidden', display_name: 'Hidden', visibility: 'hidden' },
        ] });
      }
      if (url === RESOURCE + '/responses') {
        assert.equal(options.headers.Authorization, 'Bearer test-access-2');
        const body = JSON.parse(options.body);
        assert.equal(body.model, 'gpt-6.2-sol');
        assert.equal(body.store, false);
        assert.equal(body.stream, true);
        assert.equal(body.max_output_tokens, undefined);
        if (body.text.format.name === 'step1_rig_analysis') {
          visionCount++;
          assert.equal(body.input.length, 1);
          assert.equal(body.input[0].content.filter(c => c.type === 'input_image').length, 2);
          assert.match(body.instructions, /대표 이미지/);
          return events({ type: 'response.output_text.delta', delta: '{"parts":[{"id":"head","points":[{"x":0.1,"y":0.1},{"x":0.9,"y":0.1},{"x":0.5,"y":0.7}],"pivot":{"x":0.5,"y":0.65}}]}' }, { type: 'response.completed' });
        }
        inferenceCount++;
        assert.match(body.instructions, /모찌/);
        assert.match(body.instructions, /user·assistant 대화 흐름 전체/);
        assert.match(body.instructions, /직전 실제 답변의 상황은 empathizing/);
        assert.equal(body.input[0].content, '이전 대화');
        return events({ type: 'response.output_text.delta', delta: '{"reply":"안녕!","situation":"casual","reaction":{"emotion":"happy","intensity":0.6,"action":"nod"}}' }, { type: 'response.completed' });
      }
      if (url === ISSUER + '/.well-known/openid-configuration') return jsonResponse({ revocation_endpoint: ISSUER + '/revoke-test' });
      if (url === ISSUER + '/revoke-test') {
        revocationCount++;
        assert.equal(options.body.get('token'), 'test-refresh-2');
        return new Response(null, { status: 200 });
      }
      throw new Error('Unexpected endpoint');
    },
  });
  try {
    connector.initialize();
    await connector.signIn();
    assert.equal(authorization.origin, ISSUER);
    assert.equal(authorization.searchParams.get('client_id'), 'dynamic_agent_client');
    assert.equal(authorization.searchParams.get('agent_name_hint'), 'Step1');
    assert.equal(authorization.searchParams.get('ext_agent_host_id'), saved.hostId);
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    const call = async state => {
      let status;
      await callback({ method: 'GET', url: '/auth/callback?' + new URLSearchParams({ state, client_id: CLIENT_ID, code: 'test-code' }), headers: { host: '127.0.0.1:54321' } },
        { writeHead(value) { status = value; }, end() {} });
      return status;
    };
    assert.equal(await call('wrong-state'), 400);
    assert.equal(exchangeCount, 0);
    assert.equal(await call(authorization.searchParams.get('state')), 200);
    assert.equal(closed, true);
    assert.equal(exchangeCount, 1);
    for (let i = 0; i < 20 && connector.view().pending; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(connector.view().mode, 'chatgpt');
    assert.equal(connector.view().connected, true);
    assert.equal(refreshCount, 1);
    assert.deepEqual(connector.view().models, [{ id: 'gpt-6.2-sol', label: 'GPT' }]);
    assert.equal(connector.view().welcome, true);
    connector.dismissWelcome();
    assert.equal(connector.view().welcome, false);
    assert.equal((await connector.generate('안녕', { name: '모찌', personality: 'warm', tone: 'casual' }, [{ role: 'user', content: '이전 대화' }], 'empathizing')).reaction.emotion, 'happy');
    assert.equal(inferenceCount, 1);
    assert.equal((await connector.analyzeRigImages(['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB']))[0].id, 'head');
    assert.equal(visionCount, 1);
    assert.ok(!JSON.stringify(states).includes('test-access'));
    assert.ok(!JSON.stringify(states).includes('test-refresh'));
    await connector.signOut();
    assert.equal(revocationCount, 1);
    assert.equal(saved.accounts[0].accessToken, null);
    assert.equal(saved.accounts[0].refreshToken, null);
    assert.equal(connector.view().mode, 'backend');
    assert.equal(connector.view().connected, false);
    // The stable host and issued registration are reused on later sign-in.
    const hostId = saved.hostId;
    await connector.signIn(CLIENT_ID);
    assert.equal(authorization.searchParams.get('client_id'), CLIENT_ID);
    assert.equal(authorization.searchParams.get('ext_agent_host_id'), hostId);
    assert.equal(authorization.searchParams.has('agent_name_hint'), false);
  } finally { connector.dispose(); }
});
