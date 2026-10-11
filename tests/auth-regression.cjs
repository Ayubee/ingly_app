// Controlled network/storage tests. These are not live-backend acceptance tests.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { load, hooks, screen, flush } = require('./helpers/auth-harness.cjs');
const { mobileEnvironment, browserEnvironment } = require('./helpers/environment.cjs');
const { inspect } = require('../scripts/auth-backend-check.cjs');
const session = { user: { id: 'A' }, access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Date.now()/1000 + 3600 };
const profile = { id: 'A', auth_user_id: 'A', full_name: 'Test User', username: 'test_user', phone: '+998000000000', daily_goal: 20, is_blocked: false };
function service(auth) { return load('mobile/src/services/authService.js', { './supabaseClient.js': { supabase: { auth } }, '@supabase/supabase-js': { createClient: () => ({ auth }) } }); }
async function provider(remote, memory = new Map(), initial = session, sdkError = null) {
  const native = { getItem: async key => memory.get(key) ?? null, setItem: async (key,value) => memory.set(key,value), removeItem: async key => memory.delete(key) };
  const storage = load('mobile/src/services/storage.js', { '@react-native-async-storage/async-storage': { default: native }, './environment.js': mobileEnvironment });
  if (initial) await storage.authStorage.setItem('ingly_supabase_auth_v2', JSON.stringify(initial));
  let current = initial || JSON.parse(await storage.authStorage.getItem('ingly_supabase_auth_v2') || 'null'), listener, signOuts = 0, lifecycle, starts = 0, stops = 0;
  const auth = {
    getSession: async () => ({ data: { session: sdkError ? null : current }, error: sdkError }),
    onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    signOut: async () => { signOuts++; current = null; listener('SIGNED_OUT', null); return {}; },
    signInWithPassword: async () => { current = session; await storage.authStorage.setItem('ingly_supabase_auth_v2', JSON.stringify(session)); listener('SIGNED_IN', session); return { data: { session } }; },
    startAutoRefresh: () => starts++, stopAutoRefresh: () => stops++,
  };
  const h = hooks();
  const module = load('mobile/src/context/UserContext.js', {
    react: h.React, 'react-native': { Alert: { alert() {} }, AppState: { currentState: 'active', addEventListener: (_event,callback) => { lifecycle = callback; return { remove() {} }; } } },
    '../services/storage.js': storage, '../services/userService.js': { fetchUserRemoteStatus: remote },
    '../services/syncEngine.js': { startAutoSync() {}, stopAutoSync() {} },
    '../services/sessionCache.js': load('mobile/src/services/sessionCache.js', { './storage.js': storage }),
    '../data/all_words.json': [], '../services/leaderboardService.js': { syncUserLeaderboardScore: async () => {} },
    '../services/supabaseClient.js': { supabase: { auth } }, '../services/authService.js': service(auth),
  });
  const api = () => h.render(() => module.UserProvider({ children: null }));
  api(); const cleanup = h.effects[0]();
  await flush(); await flush();
  return { api: () => api().value, storage, memory, cleanup, lifecycle: value => lifecycle(value), counters: () => ({ starts, stops, signOuts }), settle: async () => { await new Promise(resolve => setTimeout(resolve, 5)); await flush(); } };
}
let passed = 0;
async function test(name, run) { await run(); console.log('PASS ' + (++passed) + ': ' + name); }
(async () => {
  await test('registration form sends normalized contact/metadata; confirmation pending does not invent a session', async () => {
    let submitted;
    const s = service({ signUp: async payload => { submitted = payload; return { data: { session: null } }; } });
    const form = screen({ register: async input => { const data = await s.registerAccount(input); return { success: true, needsVerification: !data.session, phone: data.phone }; } });
    await form.press("Ro'yxatdan o'tish");
    form.input('Masalan: Ayubbek Qodirov', 'Test User'); form.input('+998 90 123 45 67', '000000000');
    form.input('Masalan: ayubeey', 'test_user'); form.input("Yangi parol o'ylab toping", 'test-password');
    await form.press("Ro'yxatdan o'tish va Boshlash 🚀");
    assert.equal(submitted.phone, '+998000000000'); assert.equal(submitted.options.data.username, 'test_user');
    assert(!('role' in submitted.options.data)); assert(!('is_premium' in submitted.options.data));
    assert(form.render().children.some(node => node?.type === 'TextInput' && node.placeholder === 'SMS kod'));
  });
  await test('invalid username/phone/password never reach Auth; unconfirmed phone resend and OTP use Auth', async () => {
    let requests = 0, resends = 0, verified = 0;
    const s = service({ signInWithPassword: async () => { requests++; return { error: { code: 'phone_not_confirmed' } }; },
      resend: async () => { resends++; return {}; }, verifyOtp: async payload => { verified++; assert.equal(payload.type, 'sms'); return { data: { session } }; }, signUp: async () => { requests++; return {}; } });
    await assert.rejects(s.loginAccount({ loginOrPhone: 'username', password: 'pass' }));
    await assert.rejects(s.registerAccount({ fullName: 'Test', phone: '000000000', username: 'test', password: '      ' }));
    assert.equal(requests, 0);
    assert.equal((await s.loginAccount({ loginOrPhone: '000000000', password: 'test-password' })).needsVerification, true);
    await s.resendRegistration('000000000'); await s.verifyRegistration('000000000', '123456');
    assert.equal(resends, 2); assert.equal(verified, 1);
  });
  await test('profile missing/schema/RLS failures keep Auth identity and expose retryable error', async () => {
    for (const remote of [async () => null, async () => { throw { code: '42703', message: 'sensitive backend value' }; }, async () => ({ ...profile, id: 'wrong' })]) {
      const p = await provider(remote); assert.equal(p.api().user.isLoggedIn, true); assert(p.api().profileError);
      assert(!p.api().profileError.includes('sensitive')); assert.equal(p.counters().signOuts, 0); p.cleanup();
    }
  });
  await test('existing account loads profile; retry recovers missing profile without new login', async () => {
    let ready = false; const p = await provider(async () => ready ? profile : null);
    ready = true; await p.api().retryProfile(); await p.settle();
    assert.equal(p.api().profileError, null); assert.equal(p.api().user.name, profile.full_name); p.cleanup();
  });
  await test('logout/relogin and provider restart restore SDK session; refresh follows AppState', async () => {
    const p = await provider(async () => profile); p.lifecycle('background'); p.lifecycle('active');
    assert(p.counters().starts >= 2); assert(p.counters().stops >= 1);
    await p.api().logout(); await p.settle(); assert.equal(p.api().user.isLoggedIn, false);
    assert.equal(await p.storage.authStorage.getItem('ingly_supabase_auth_v2'), null);
    const result = await p.api().login({ loginOrPhone: '000000000', password: 'test-password' }); await p.settle();
    assert.equal(result.success, true); assert.equal(p.api().user.name, profile.full_name);
    p.cleanup(); const restored = await provider(async () => profile, p.memory, null);
    // Offline restoration reads only SDK cache, never a profile-only login flag.
    assert.equal(restored.api().user.id, 'A'); restored.cleanup();
  });
  await test('wrong password, disabled provider, SQL and network failures have safe Uzbek messages', async () => {
    const s = service({});
    for (const error of [{ code: 'invalid_credentials' }, { code: 'phone_provider_disabled' }, { code: '42703', message: 'private SQL value' }, { name: 'AuthRetryableFetchError', message: 'Failed to fetch' }]) {
      const message = s.authErrorMessage(error); assert(message.length > 20); assert(!message.includes('private SQL'));
    }
  });
  await test('transient SDK restore failure preserves a valid cached session; invalid refresh clears UI identity', async () => {
    const offline = await provider(async () => profile, new Map(), session, { name: 'AuthRetryableFetchError' });
    assert.equal(offline.api().user.id, 'A'); assert.equal(offline.api().user.isLoggedIn, true); offline.cleanup();
    const invalid = await provider(async () => profile, new Map(), session, { name: 'AuthApiError', code: 'refresh_token_not_found' });
    assert.equal(invalid.api().user.isLoggedIn, false); invalid.cleanup();
  });
  await test('admin Auth and role stages stay separate; ordinary user denied, authorized admin accepted', async () => {
    let access = null, signouts = 0;
    const client = { auth: { getUser: async () => ({ data: { user: { id: 'A' } } }), signInWithPassword: async () => ({}), signOut: async () => { signouts++; return {}; } }, rpc: async () => ({ data: access }) };
    const store = { getItem: () => null, setItem() {}, removeItem() {} };
    const ctx = { window: { ...browserEnvironment(), supabase: { createClient: () => client } }, localStorage: store, sessionStorage: store };
    vm.runInNewContext(fs.readFileSync('admin/public/auth.js', 'utf8'), ctx);
    await assert.rejects(ctx.window.inglyAuth.login('admin_username', 'test-password'), error => error.code === 'invalid_email');
    await assert.rejects(ctx.window.inglyAuth.login('test@example.invalid', 'test-password'), error => error.code === 'admin_access_denied');
    assert.equal(signouts, 1); access = { id: 'admin-row', auth_user_id: 'A', role: 'editor' };
    assert.equal((await ctx.window.inglyAuth.login('test@example.invalid', 'test-password')).role, 'editor');
    client.rpc = async () => ({ error: { code: 'PGRST202' } });
    await assert.rejects(ctx.window.inglyAuth.login('test@example.invalid', 'test-password'), error => error.code === 'PGRST202'); assert.equal(signouts, 1);
  });
  await test('public readiness distinguishes absent schema and disabled signup from protected objects', async () => {
    let count = 0;
    const report = await inspect({ environment: 'production', projectRef: 'test', url: 'https://test.invalid', publicKey: 'public' }, async () => {
      const data = ++count === 1 ? { external: { phone: false, email: true }, disable_signup: false } : count === 2 ? { code: '42703' } : { code: '42501' };
      return { ok: count === 1, status: count === 1 ? 200 : 400, json: async () => data };
    });
    assert.equal(report.ready, false); assert.equal(report.checks.find(check => check.name === 'profile_schema').result, 'FAIL');
    assert.equal(report.checks.find(check => check.name === 'admin_rpc').result, 'PASS');
  });
  await test('admin logout invalidates an in-flight successful authorization', async () => {
    let release;
    const gate = new Promise(resolve => release = resolve);
    const client = { auth: { getUser: async () => ({ data: { user: { id: 'A' } } }), signInWithPassword: async () => ({}), signOut: async () => ({}) }, rpc: () => gate };
    const store = { getItem: () => null, setItem() {}, removeItem() {} };
    const ctx = { window: { ...browserEnvironment(), supabase: { createClient: () => client } }, localStorage: store, sessionStorage: store };
    vm.runInNewContext(fs.readFileSync('admin/public/auth.js', 'utf8'), ctx);
    const pending = ctx.window.inglyAuth.login('test@example.invalid', 'test-password');
    await flush(); await ctx.window.inglyAuth.logout();
    release({ data: { id: 'admin-row', auth_user_id: 'A', role: 'editor' } });
    await assert.rejects(pending, error => error.code === 'session_not_found');
  });
  await test('hung HTTP is aborted and timeout cleaned; SDK uses processLock', async () => {
    let timeout, cleared = 0, config, aborted = false;
    const lock = () => {};
    const client = load('mobile/src/services/supabaseClient.js', {
      '@supabase/supabase-js': { createClient: (_url,_key,options) => { config = options; return {}; }, processLock: lock },
      './storage.js': { authStorage: {} }, './environment.js': { APP_CONFIG: { url: 'https://test.invalid', publicKey: 'public' } },
    }, { setTimeout: callback => { timeout = callback; return 1; }, clearTimeout: () => cleared++,
      fetch: (_url,options) => new Promise((_resolve,reject) => options.signal.addEventListener('abort', () => { aborted = true; const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); })) });
    const pending = client.fetchWithTimeout('https://test.invalid'); timeout();
    await assert.rejects(pending, error => error.name === 'AbortError'); assert(aborted); assert.equal(cleared, 1); assert.equal(config.auth.lock, lock);
  });
  await test('registration form prevents duplicate network submissions and leaves loading after failure', async () => {
    let release, requests = 0;
    const gate = new Promise(resolve => release = resolve);
    const form = screen({ login: async () => { requests++; return gate; } });
    form.input('masalan: +998901234567', '000000000'); form.input('Parolingizni kiriting', 'test-password');
    const pending = form.press('Kirish ➔');
    await form.press('Kutilmoqda…'); assert.equal(requests, 1);
    release({ success: false, error: 'Serverga ulanib bo‘lmadi.' }); await pending;
    assert(form.alerts.some(alert => alert[1] === 'Serverga ulanib bo‘lmadi.'));
    assert(form.render());
  });
  console.log(`AUTH REGRESSION: ${passed} PASS, 0 FAIL. Controlled fixtures, not live login proof.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
