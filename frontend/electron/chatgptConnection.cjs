const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const emotions = Object.keys(require('./emotionConfig.json'));
const { SITUATIONS, expressionInstructions, normalizeContextualReaction } = require('./conversationExpression.cjs');
const { RIG_ANALYSIS_SCHEMA, validateRigImages, parseRigAnalysis, rigVisionInput, RIG_VISION_INSTRUCTIONS } = require('./rigVision.cjs');

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const AUTHORIZE = ISSUER + '/api/accounts/authorize';
const TOKEN = ISSUER + '/api/accounts/oauth/token';
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const CALLBACK = '/auth/callback';

class ConnectionError extends Error {
  constructor(message, code = '') {
    super(message);
    this.code = code;
  }
}

function apiError(status, code) {
  if (code === 'subscription_sharing_usage_limit_exceeded' || status === 429)
    return new ConnectionError('ChatGPT 사용 한도에 도달했어요. 사용량 설정을 확인해 주세요.', 'limit');
  if (code === 'subscription_sharing_user_not_eligible')
    return new ConnectionError('이 ChatGPT 계정 또는 워크스페이스에서는 구독 연동을 사용할 수 없어요.', 'ineligible');
  if (status === 401 || code === 'subscription_sharing_invalid_user')
    return new ConnectionError('ChatGPT 연결이 만료되었어요. 계정을 다시 연결해 주세요.', 'auth');
  if (status === 403 || ['subscription_sharing_route_not_supported', 'chatpass_v2_scope_not_authorized', 'chatpass_v2_invalid_authorization_context'].includes(code))
    return new ConnectionError('ChatGPT 계정에서 이 요청을 허용하지 않아요. 연결 및 사용량 설정을 확인해 주세요.', 'permission');
  if (code === 'subscription_sharing_unsupported_capability' || status === 400)
    return new ConnectionError('선택한 모델이 이 요청을 지원하지 않아요. 다른 모델을 선택해 주세요.', 'model');
  return new ConnectionError('ChatGPT에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.', 'unavailable');
}

const random = () => crypto.randomBytes(32).toString('base64url');
const challenge = verifier => crypto.createHash('sha256').update(verifier).digest('base64url');
const validClientId = value => typeof value === 'string' && /^oaiapp_[A-Za-z0-9_-]+$/.test(value);
const planEnabled = account => account?.scopes?.includes(PLAN_SCOPE) && Boolean(account.accessToken);

function makeAuthorizationUrl(attempt, hostId, account) {
  const url = new URL(AUTHORIZE);
  const params = {
    client_id: account?.clientId || 'dynamic_agent_client',
    ext_agent_host_id: hostId,
    response_type: 'code',
    redirect_uri: attempt.redirectUri,
    scope: SCOPE,
    resource: RESOURCE,
    state: attempt.state,
    nonce: attempt.nonce,
    code_challenge_method: 'S256',
    code_challenge: challenge(attempt.verifier),
  };
  if (!account) params.agent_name_hint = 'Step1';
  if (account?.idToken) params.id_token_hint = account.idToken;
  else if (account?.email) params.login_hint = account.email;
  if (account && !account.scopes?.includes(PLAN_SCOPE)) params.prompt = 'consent';
  url.search = new URLSearchParams(params).toString();
  return url.toString();
}

async function validateIdentity(idToken, clientId, nonce, fetcher) {
  if (typeof idToken !== 'string') throw new ConnectionError('ChatGPT 계정 정보를 확인하지 못했어요.');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new ConnectionError('ChatGPT 계정 정보를 확인하지 못했어요.');
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    throw new ConnectionError('ChatGPT 계정 정보를 확인하지 못했어요.');
  }
  // Pin the issuer and allowed signing algorithm; never trust a key URL from a token.
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new ConnectionError('계정 서명을 확인하지 못했어요.');
  const jwksResponse = await fetcher(ISSUER + '/.well-known/jwks.json', { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!jwksResponse.ok) throw new ConnectionError('계정 서명 키를 확인하지 못했어요.');
  const jwks = await jwksResponse.json();
  const key = jwks.keys?.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
  const now = Date.now() / 1000;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!key || !crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url')) ||
      claims.iss !== ISSUER || !aud.includes(clientId) || (aud.length > 1 && claims.azp !== clientId) ||
      (claims.azp && claims.azp !== clientId) || claims.nonce !== nonce || !Number.isFinite(claims.exp) || claims.exp < now - 5 ||
      !Number.isFinite(claims.iat) || claims.iat > now + 5 || (claims.nbf && claims.nbf > now + 5) ||
      typeof claims.sub !== 'string' || !claims.sub) {
    throw new ConnectionError('ChatGPT 계정 인증을 확인하지 못했어요. 다시 로그인해 주세요.');
  }
  return claims;
}

function tokenFields(tokens, previous = {}) {
  if (!tokens || typeof tokens.access_token !== 'string' || !tokens.access_token ||
      !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0 || String(tokens.token_type).toLowerCase() !== 'bearer')
    throw new ConnectionError('ChatGPT 인증 응답이 올바르지 않아요.');
  return {
    accessToken: tokens.access_token,
    refreshToken: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : null,
    idToken: tokens.id_token || previous.idToken || null,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/).filter(Boolean) : previous.scopes || [],
  };
}

function clearTokens(account) {
  return { ...account, accessToken: null, refreshToken: null, idToken: null, expiresAt: 0, scopes: [] };
}

function createPrivateStore(dir, safeStorage) {
  const file = path.join(dir, 'chatgpt-connection.enc');
  return {
    load() {
      if (!safeStorage?.isEncryptionAvailable()) return null;
      try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(file))); }
      catch (error) {
        if (error.code === 'ENOENT') return null;
        throw new ConnectionError('저장된 계정 정보를 열 수 없어요. 키체인을 확인해 주세요.');
      }
    },
    save(value) {
      if (!safeStorage?.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text')
        throw new ConnectionError('안전한 계정 저장소를 사용할 수 없어요. OS 키체인을 확인해 주세요.');
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const temp = file + '.' + random() + '.tmp';
      try {
        fs.writeFileSync(temp, safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600, flag: 'wx' });
        fs.renameSync(temp, file);
      } finally {
        try { fs.unlinkSync(temp); } catch {}
      }
    },
  };
}

function responseInstructions(profile, previousSituation) {
  const personalities = {
    warm: '다정하고 공감하는 친구', playful: '밝고 재치 있으나 상대의 기분을 존중하는 친구',
    calm: '차분하고 부드러운 친구', focused: '명료하고 실용적으로 돕는 친구',
  };
  const tones = { casual: '친근한 반말', polite: '부드러운 존댓말', brief: '짧은 반말' };
  return [
    '너는 Step1의 데스크톱 AI 캐릭터야. 이름 데이터: ' + JSON.stringify(profile?.name || 'Companion'),
    '성격: ' + (personalities[profile?.personality] || personalities.warm),
    '말투: ' + (tones[profile?.tone] || tones.casual),
    '사용자의 언어로 자연스럽게 보통 1~4문장으로 답하고 과도한 의존을 유도하지 않는다. 실제 감정이나 기억을 가진 것처럼 주장하지 않는다.',
    'reply에는 사용자에게 실제로 보여 줄 대사만 담는다. 상황 분류와 반응은 별도 필드로 제공한다.',
    expressionInstructions(previousSituation),
    '반드시 JSON 객체 {"reply":"대사","situation":"casual","reaction":{"emotion":"neutral","intensity":0.5,"action":"idle"}} 형태로만 출력한다.',
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reply', 'situation', 'reaction'],
  properties: {
    reply: { type: 'string' },
    situation: { type: 'string', enum: Object.keys(SITUATIONS) },
    reaction: { type: 'object', additionalProperties: false, required: ['emotion', 'intensity', 'action'],
      properties: { emotion: { type: 'string', enum: emotions }, intensity: { type: 'number' },
        action: { type: 'string', enum: ['idle', 'nod', 'shake', 'bounce'] } } },
  },
};

function parseReaction(text) {
  let result;
  try { result = JSON.parse(text.trim()); } catch { throw new ConnectionError('AI 답변 형식이 올바르지 않아요. 다시 시도해 주세요.'); }
  const r = result?.reaction;
  if (typeof result?.reply !== 'string' || !result.reply.trim() || !emotions.includes(r?.emotion) ||
      !['idle', 'nod', 'shake', 'bounce'].includes(r?.action) || !Number.isFinite(r?.intensity) || r.intensity < 0 || r.intensity > 1)
    throw new ConnectionError('AI 답변 형식이 올바르지 않아요. 다시 시도해 주세요.');
  const reaction = normalizeContextualReaction(result.situation, r);
  if (!reaction) throw new ConnectionError('AI의 대화 상황을 확인하지 못했어요. 다시 시도해 주세요.');
  return { reply: result.reply, situation: result.situation, reaction };
}

async function readResponseStream(response, parse = parseReaction) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw apiError(response.status, body.error?.code);
  }
  if (!response.body) throw new ConnectionError('ChatGPT 응답을 받지 못했어요.');
  let buffer = '', text = '', completed = false;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  try {
    while (!completed) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') continue;
        let event;
        try { event = JSON.parse(data); } catch { throw new ConnectionError('ChatGPT 응답을 읽지 못했어요.'); }
        if (event.type === 'response.output_text.delta') {
          text += event.delta || '';
          if (text.length > 32000) throw new ConnectionError('AI 응답이 너무 길어요. 다시 시도해 주세요.');
        } else if (event.type === 'response.completed') {
          completed = true;
          // Some compatible streams supply final text without deltas.
          if (!text) text = (event.response?.output || []).flatMap(item => item.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
          break;
        } else if (event.type === 'response.failed' || event.type === 'error') {
          const error = event.response?.error || event.error || event;
          throw apiError(error.status || 0, error.code);
        } else if (event.type === 'response.incomplete') {
          throw new ConnectionError('ChatGPT 답변이 완료되지 않았어요. 다시 시도해 주세요.');
        }
      }
      if (buffer.length > 128000) throw new ConnectionError('ChatGPT 응답을 읽지 못했어요.');
      if (done) break;
    }
    if (!completed) throw new ConnectionError('ChatGPT 연결이 중간에 끊겼어요. 다시 시도해 주세요.');
    return parse(text);
  } finally { await reader.cancel().catch(() => {}); }
}

function createChatGPTConnection({ store, openBrowser, publish = () => {}, fetcher = fetch, createServer = http.createServer }) {
  let data = { hostId: null, mode: 'backend', activeId: null, accounts: [] };
  let pending = null;
  let error = '';
  let loading = false;
  let models = [];
  let refreshing = null;
  let modeVersion = 0;
  function active() { return data.accounts.find(a => a.clientId === data.activeId); }
  function view() {
    const account = active();
    return {
      mode: data.mode, activeId: data.activeId,
      accounts: data.accounts.map((a, i) => ({ id: a.clientId, label: (a.email || a.name || 'ChatGPT 계정') + ' · ' + (i+1), connected: !!planEnabled(a) })),
      connected: !!planEnabled(account), pending: !!pending || loading, signingIn: !!pending && !pending.exchanging, error,
      models, model: account?.model || null,
      welcome: data.mode === 'chatgpt' && !!planEnabled(account) && !account.welcomed,
    };
  }
  function emit() { publish(view()); }
  function save(next) { store.save(next); data = next; }
  function replaceAccount(account, extra = {}) {
    const accounts = data.accounts.filter(a => a.clientId !== account.clientId);
    const index = data.accounts.findIndex(a => a.clientId === account.clientId);
    accounts.splice(index < 0 ? accounts.length : index, 0, account);
    save({ ...data, accounts, ...extra });
  }
  function setError(message) { error = message; emit(); }
  function initialize() {
    try {
      const loaded = store.load();
      if (loaded?.hostId && Array.isArray(loaded.accounts)) data = loaded;
    } catch (e) { error = e.message; }
    emit();
    if (data.mode === 'chatgpt' && planEnabled(active())) void refreshModels();
  }
  async function formRequest(url, fields) {
    return fetcher(url, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(fields), signal: AbortSignal.timeout(20000), redirect: 'error',
    });
  }
  async function getAccessToken(account) {
    if (!planEnabled(account)) throw new ConnectionError('먼저 ChatGPT 계정을 연결해 주세요.', 'auth');
    if (account.expiresAt > Date.now() + 60000) return account.accessToken;
    if (!account.refreshToken) throw new ConnectionError('ChatGPT 계정을 다시 연결해 주세요.', 'auth');
    if (refreshing) {
      if (refreshing.clientId !== account.clientId) throw new ConnectionError('계정 연결을 완료한 뒤 다시 시도해 주세요.');
      return refreshing.promise;
    }
    const promise = (async () => {
      const res = await formRequest(TOKEN, { grant_type: 'refresh_token', client_id: account.clientId, refresh_token: account.refreshToken, resource: RESOURCE });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused'].includes(body.error)) {
          replaceAccount(clearTokens(account));
          emit();
          throw new ConnectionError('ChatGPT 연결이 만료되었어요. 다시 로그인해 주세요.', 'auth');
        }
        throw apiError(res.status, body.error?.code || body.error);
      }
      const updated = { ...account, ...tokenFields(body, account) };
      replaceAccount(updated);
      emit();
      if (!planEnabled(updated)) throw new ConnectionError('ChatGPT 사용 권한이 없어요. 다시 연결해 주세요.', 'auth');
      return updated.accessToken;
    })();
    refreshing = { clientId: account.clientId, promise };
    try { return await promise; } finally { refreshing = null; }
  }
  async function refreshModels() {
    const account = active();
    if (!planEnabled(account) || loading) return;
    loading = true; error = ''; emit();
    try {
      const token = await getAccessToken(account);
      const response = await fetcher(RESOURCE + '/models', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(20000), redirect: 'error' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw apiError(response.status, body.error?.code);
      models = (body.models || []).filter(m => m.visibility === 'list' && typeof m.slug === 'string' && typeof m.display_name === 'string')
        .map(m => ({ id: m.slug, label: m.display_name }));
      if (!models.length) throw new ConnectionError('이 계정에서 사용 가능한 모델을 찾지 못했어요.');
      const current = active();
      if (current?.clientId === account.clientId && !models.some(m => m.id === current.model))
        replaceAccount({ ...current, model: models.find(m => m.id === 'gpt-6.2-sol')?.id || models[0].id });
    } catch (e) { error = e instanceof ConnectionError ? e.message : 'ChatGPT 모델 목록에 연결할 수 없어요. 다시 시도해 주세요.'; }
    finally { loading = false; emit(); }
  }
  async function exchange(attempt, url) {
    const code = url.searchParams.get('code');
    const returnedClient = url.searchParams.get('client_id');
    const clientId = attempt.account?.clientId || returnedClient;
    if (url.searchParams.has('error')) throw new ConnectionError('ChatGPT 로그인 또는 사용 권한이 취소되었어요.');
    if (!code || !validClientId(clientId) || (returnedClient && returnedClient !== clientId))
      throw new ConnectionError('ChatGPT 계정 등록 정보를 확인하지 못했어요.');
    const res = await formRequest(TOKEN, { grant_type: 'authorization_code', client_id: clientId, code, code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri, resource: RESOURCE });
    const tokens = await res.json().catch(() => ({}));
    if (!res.ok) throw new ConnectionError('ChatGPT 로그인 인증에 실패했어요. 다시 시도해 주세요.');
    const identity = await validateIdentity(tokens.id_token, clientId, attempt.nonce, fetcher);
    const previous = data.accounts.find(a => a.clientId === clientId);
    if (previous && previous.subject !== identity.sub) throw new ConnectionError('선택한 계정과 로그인 계정이 달라요.');
    const scopes = typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/).filter(Boolean) : [];
    const fields = scopes.includes(PLAN_SCOPE) ? tokenFields(tokens) : { ...clearTokens(previous || {}), idToken: tokens.id_token, scopes };
    const account = { ...previous, ...fields, clientId, subject: identity.sub, email: typeof identity.email === 'string' ? identity.email : '',
      name: typeof identity.name === 'string' ? identity.name : '', welcomed: previous?.welcomed || false };
    if (!planEnabled(account)) {
      replaceAccount(account);
      throw new ConnectionError('로그인은 완료됐지만 ChatGPT 구독 사용 권한이 승인되지 않았어요.');
    }
    replaceAccount(account, { activeId: clientId, mode: 'chatgpt' });
    modeVersion++; models = []; error = '';
  }
  function cancelLogin() {
    if (!pending || pending.exchanging) return false;
    const attempt = pending;
    pending = null; clearTimeout(attempt.timer); attempt.server.close();
    emit(); return true;
  }
  async function signIn(id) {
    if (pending || loading) return view();
    const account = id ? data.accounts.find(a => a.clientId === id) : null;
    if (id && !account) return view();
    error = '';
    try {
      if (!data.hostId) save({ ...data, hostId: 'urn:uuid:' + crypto.randomUUID() });
      const attempt = { account, state: random(), nonce: random(), verifier: random() + random(), exchanging: false };
      const server = createServer(async (req, res) => {
        const finish = (status, message) => {
          res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
          res.end(message);
        };
        let url;
        try { url = new URL(req.url, attempt.redirectUri); } catch { return finish(400, 'Invalid callback.'); }
        if (req.method !== 'GET' || req.headers.host !== new URL(attempt.redirectUri).host || url.pathname !== CALLBACK)
          return finish(404, 'Not found.');
        if (pending !== attempt || attempt.exchanging || url.searchParams.get('state') !== attempt.state)
          return finish(400, 'Invalid or expired login attempt.');
        attempt.exchanging = true; clearTimeout(attempt.timer);
        try {
          await exchange(attempt, url);
          finish(200, 'Step1 연결 완료! 이 탭을 닫고 앱으로 돌아가 주세요.');
        } catch (e) {
          error = e instanceof ConnectionError ? e.message : 'ChatGPT 연결에 실패했어요. 다시 시도해 주세요.';
          finish(400, 'Step1 계정 연결을 완료하지 못했어요. 앱으로 돌아가 주세요.');
        } finally {
          pending = null; server.close(); emit();
          if (data.mode === 'chatgpt' && !error) void refreshModels();
        }
      });
      attempt.server = server;
      pending = attempt; emit();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      if (pending !== attempt) { server.close(); return view(); }
      attempt.redirectUri = 'http://127.0.0.1:' + server.address().port + CALLBACK;
      attempt.timer = setTimeout(() => { cancelLogin(); setError('로그인 시간이 초과되었어요. 다시 시도해 주세요.'); }, 10 * 60 * 1000);
      await openBrowser(makeAuthorizationUrl(attempt, data.hostId, account));
    } catch (e) {
      cancelLogin();
      error = e instanceof ConnectionError ? e.message : 'ChatGPT 로그인 창을 열지 못했어요.';
      emit();
    }
    return view();
  }
  async function select(id) {
    if (pending || loading || refreshing) return view();
    const account = data.accounts.find(a => a.clientId === id);
    if (!account) return view();
    if (!planEnabled(account)) return signIn(id);
    try { save({ ...data, mode: 'chatgpt', activeId: id }); modeVersion++; models = []; await refreshModels(); }
    catch (e) { setError(e instanceof ConnectionError ? e.message : '계정을 선택하지 못했어요.'); }
    return view();
  }
  function useBackend() {
    if (pending || loading || refreshing) return view();
    try { save({ ...data, mode: 'backend' }); modeVersion++; error = ''; emit(); }
    catch (e) { setError(e instanceof ConnectionError ? e.message : '연결 방식을 변경하지 못했어요.'); }
    return view();
  }
  async function signOut() {
    if (pending || loading || refreshing || !active()) return view();
    const account = active();
    loading = true; emit();
    let revoked = !account.refreshToken;
    try {
      if (account.refreshToken) {
        const metadata = await fetcher(ISSUER + '/.well-known/openid-configuration', { signal: AbortSignal.timeout(15000), redirect: 'error' });
        const config = await metadata.json();
        const endpoint = new URL(config.revocation_endpoint);
        if (!metadata.ok || endpoint.origin !== ISSUER || endpoint.protocol !== 'https:') throw new Error('invalid endpoint');
        for (let retry = 0; retry < 2; retry++) {
          try {
            const res = await formRequest(endpoint.toString(), { token: account.refreshToken, token_type_hint: 'refresh_token', client_id: account.clientId });
            if (res.ok) { revoked = true; break; }
            if (res.status < 500) break;
          } catch {}
          if (retry === 0) await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch {}
    try {
      replaceAccount(clearTokens(account), { mode: 'backend', activeId: null });
      modeVersion++; models = [];
      error = revoked ? '' : '이 기기의 연결은 해제했어요. ChatGPT 설정에서 원격 연결 해제를 확인해 주세요.';
    } catch { error = '저장된 계정 연결을 해제하지 못했어요. 키체인을 확인해 주세요.'; }
    finally { loading = false; emit(); }
    return view();
  }
  function selectModel(id) {
    if (loading || pending || !active() || !models.some(m => m.id === id)) return view();
    try { replaceAccount({ ...active(), model: id }); error = ''; emit(); }
    catch { setError('모델 설정을 저장하지 못했어요.'); }
    return view();
  }
  function dismissWelcome() {
    if (active()) {
      try { replaceAccount({ ...active(), welcomed: true }); emit(); } catch { setError('설정을 저장하지 못했어요.'); }
    }
    return view();
  }
  async function generate(message, profile, history, previousSituation) {
    const account = active();
    if (data.mode !== 'chatgpt' || !planEnabled(account)) throw new ConnectionError('먼저 ChatGPT 계정을 연결해 주세요.', 'auth');
    if (!account.model) throw new ConnectionError('ChatGPT 모델을 선택해 주세요.', 'model');
    const version = modeVersion;
    try {
      const token = await getAccessToken(account);
      if (version !== modeVersion) throw new ConnectionError('계정이 변경되었어요. 다시 시도해 주세요.');
      const result = await fetcher(RESOURCE + '/responses', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ model: account.model, input: [...history.slice(-12), { role: 'user', content: message }],
          instructions: responseInstructions(profile, previousSituation), store: false, stream: true,
          text: { format: { type: 'json_schema', name: 'step1_reaction', strict: true, schema: RESPONSE_SCHEMA } } }),
        signal: AbortSignal.timeout(90000), redirect: 'error',
      });
      return await readResponseStream(result);
    } catch (e) {
      const failure = e instanceof ConnectionError ? e : new ConnectionError('ChatGPT 연결에 문제가 발생했어요. 다시 시도해 주세요.');
      setError(failure.message);
      throw failure;
    }
  }
  async function analyzeRigImages(images) {
    const account = active();
    if (data.mode !== 'chatgpt' || !planEnabled(account) || !account.model)
      throw new ConnectionError('대화 탭에서 ChatGPT 계정과 이미지 분석을 지원하는 모델을 연결해 주세요.');
    if (!validateRigImages(images)) throw new ConnectionError('참조 이미지 크기 또는 개수를 확인해 주세요.');
    const version = modeVersion;
    try {
      const token = await getAccessToken(account);
      if (version !== modeVersion) throw new ConnectionError('계정이 변경되었어요. 다시 시도해 주세요.');
      const result = await fetcher(RESOURCE + '/responses', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ model: account.model, input: rigVisionInput(images), instructions: RIG_VISION_INSTRUCTIONS,
          store: false, stream: true, text: { format: { type: 'json_schema', name: 'step1_rig_analysis', strict: true, schema: RIG_ANALYSIS_SCHEMA } } }),
        signal: AbortSignal.timeout(120000), redirect: 'error',
      });
      return await readResponseStream(result, parseRigAnalysis);
    } catch (error) {
      throw error instanceof ConnectionError ? error : new ConnectionError('AI 이미지 분석에 실패했어요. 수동 영역 편집으로 계속할 수 있어요.');
    }
  }
  return { initialize, view, signIn, cancelLogin, select, useBackend, signOut, selectModel, dismissWelcome, refreshModels, generate, analyzeRigImages,
    contextKey: () => data.mode === 'chatgpt' ? 'chatgpt:' + data.activeId : 'backend',
    dispose() { cancelLogin(); } };
}

module.exports = { createChatGPTConnection, createPrivateStore, makeAuthorizationUrl, validateIdentity, readResponseStream, parseReaction, ConnectionError };
