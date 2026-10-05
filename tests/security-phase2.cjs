// Offline security regression tests. No live API or production database is contacted.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const babel = require('../mobile/node_modules/@babel/core');
const parser = require('../mobile/node_modules/@babel/parser');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const plain = x => JSON.parse(JSON.stringify(x));
function moduleAt(file, dependencies = {}, globals = {}) {
  const plugins = [require.resolve('../mobile/node_modules/@babel/plugin-transform-modules-commonjs')];
  if (file.endsWith('.ts')) plugins.unshift(require.resolve('../mobile/node_modules/@babel/plugin-transform-typescript'));
  const code = babel.transformSync(read(file), { filename: file, babelrc: false, configFile: false, plugins }).code;
  const ctx = { exports: {}, console, Date, Map, Set, Math, setTimeout, clearTimeout, ...globals,
    require: name => { assert(name in dependencies, 'Unmocked import: ' + name); return dependencies[name]; } };
  vm.runInNewContext(code, ctx, { filename: file });
  return ctx.exports;
}
function deferred() { let release; const promise = new Promise(r => { release = r; }); return { promise, release }; }
async function storageTests() {
  const memory = new Map();
  let pauseRead = null;
  const native = {
    getItem: async key => { const value = memory.get(key) ?? null; if (pauseRead) { const d = pauseRead; pauseRead = null; await d.promise; } return value; },
    setItem: async (key, value) => memory.set(key, value), removeItem: async key => memory.delete(key),
  };
  const storage = moduleAt('mobile/src/services/storage.js', { '@react-native-async-storage/async-storage': { default: native } });
  const k = storage.STORAGE_KEYS;
  memory.set(k.USER_PROFILE, JSON.stringify({ id: 'legacy', password: 'secret', password_hash: 'hash', isLoggedIn: true }));
  memory.set(k.REGISTERED_USERS, 'credentials'); memory.set(k.SAVED_CARDS, 'full-card');
  memory.set(k.CUSTOM_WORDS, JSON.stringify([{ id: 'legacy-private' }]));
  await storage.purgeLegacyCredentials();
  assert(!memory.has(k.REGISTERED_USERS)); assert(!memory.has(k.SAVED_CARDS));
  assert(!JSON.parse(memory.get(k.USER_PROFILE)).password_hash);
  assert.equal((await storage.getCustomWords()).length, 0);
  storage.setStorageAccountId('A');
  await storage.addCustomWord({ id: 'private-A', original: 'salom', translated: 'hello' });
  await storage.saveWordProgress(1, 'mastered');
  await storage.toggleFavorite(1);
  const expectedA = JSON.stringify(await storage.getCustomWords());
  const hold = deferred(); pauseRead = hold;
  const staleWrite = storage.addCustomWord({ id: 'delayed-A', original: 'private' });
  storage.setStorageAccountId('B'); hold.release(); await assert.rejects(staleWrite, /session changed/i);
  for (const [key, fallback] of [[k.CUSTOM_WORDS, []], [k.WORD_PROGRESS, {}], [k.SYNC_QUEUE, []], [k.USER_STREAKS, null], [k.FAVORITES, []]])
    assert.deepEqual(plain(await storage.getStorageItem(key, fallback)), fallback);
  const manifest = JSON.parse(memory.get('@ingly_account:A:' + storage.JOURNAL_KEY));
  const journal = JSON.parse(manifest.parts.map(key => memory.get(key)).join(''));
  assert.equal(JSON.stringify(journal.values[k.CUSTOM_WORDS]), expectedA);
  assert.equal(await storage.setStorageItem(k.USER_PROFILE, { id: 'A' }, 'A'), false);
  await storage.addCustomWord({ id: 'private-B', original: 'bye' });
  storage.setStorageAccountId('A');
  assert.equal((await storage.getCustomWords())[0].id, 'private-A');
  storage.setStorageAccountId(null); assert.equal((await storage.getCustomWords()).length, 0);
  console.log('PASS: legacy credential/card purge, account-scoped private keys, stale writes, MyWords isolation.');
  return storage;
}
async function authTests() {
  const hash = 'a'.repeat(64); let submitted; let updateCount = 0; let passwordAccepted = false;
  const identity = { id: 'A', phone: '+998901234567' };
  const auth = {
    getUser: async () => ({ data: { user: identity }, error: null }),
    getSession: async () => ({ data: { session: { user: identity } } }),
    signInWithPassword: async p => { submitted = p; return passwordAccepted
      ? { data: { user: identity, session: { user: identity } }, error: null }
      : { data: {}, error: new Error('Invalid credentials') }; },
    updateUser: async () => { updateCount++; return { data: { user: identity }, error: null }; },
    signUp: async p => { submitted = p; return { data: { session: null }, error: null }; },
    verifyOtp: async p => { submitted = p; return { data: { session: { user: identity } }, error: null }; },
  };
  const service = moduleAt('mobile/src/services/authService.js', {
    './supabaseClient.js': { supabase: { auth }, SUPABASE_URL: 'test-url', SUPABASE_ANON_KEY: 'public-test-key' },
    '@supabase/supabase-js': { createClient: () => ({ auth }) },
  });
  await assert.rejects(service.loginAccount({ loginOrPhone: '+998901234567', password: hash }));
  assert.equal(submitted.password, hash); // It went to Auth; local hash equality cannot authenticate it.
  await assert.rejects(service.changeAccountPassword(hash, 'new-password')); assert.equal(updateCount, 0);
  passwordAccepted = true; await service.changeAccountPassword('correct-password', 'new-password'); assert.equal(updateCount, 1);
  await service.registerAccount({ fullName: 'Test', phone: '901234567', username: 'test', password: 'secret' });
  assert.equal(submitted.phone, '+998901234567'); assert(!submitted.options.data.is_premium);
  await service.verifyRegistration('901234567', '123456'); assert.equal(submitted.type, 'sms');
  const crypto = moduleAt('mobile/src/utils/crypto.js');
  assert.equal(crypto.verifyPassword(hash, hash), false); assert.throws(() => crypto.hashPassword('secret'));
  let writes = 0;
  const profiles = moduleAt('mobile/src/services/userService.js', { './storage.js': { captureStorageSession: () => ({owner:'A',generation:1}), isStorageSessionCurrent: () => true }, './supabaseClient.js': { supabase: { auth, from: () => { writes++; throw new Error('Should not query'); } } } });
  await assert.rejects(profiles.syncUserWithSupabase({ id: 'B', name: 'intruder', isPremium: true })); assert.equal(writes, 0);
  assert(!profiles.PROFILE_COLUMNS.includes('password'));
  console.log('PASS: hash replay rejected, Auth password reauthentication, SMS identity, explicit profiles, mismatched owner rejection.');
}
async function syncTests(storage) {
  storage.setStorageAccountId('A');
  const gate = deferred(); let payload, bearer;
  const identity = { id: 'A' };
  const sync = moduleAt('mobile/src/services/syncEngine.js', {
    './storage': storage,
    './syncConflict.js': { mergeRemoteSnapshot: async () => {} },
    './networkEvents.js': { subscribeSyncEvents: () => () => {} },
    './supabaseClient': { supabase: {
      auth: { getUser: async () => ({ data: { user: identity } }), getSession: async () => ({ data: { session: { user: identity, access_token: 'A-token' } } }) },
      rpc: (_name, body) => { payload = body; return { setHeader: (_k, value) => { bearer = value; return gate.promise; } }; },
    } },
  }, { AbortController });
  const pending = sync.syncOfflineProgress('arbitrary-target-B');
  // Let the mocked SDK steps complete and the RPC start.
  await new Promise(resolve => setImmediate(resolve));
  assert(payload && !('p_user_id' in payload)); assert.equal(bearer, 'Bearer A-token');
  storage.setStorageAccountId('B');
  await storage.addToSyncQueue({ word_id: 2, status: 'review' });
  gate.release({ data: { synced_count: 1, current_streak: 50 }, error: null });
  assert.equal((await pending).success, false);
  assert((await storage.getSyncQueue()).some(op => op.changes['word:2']?.word_id === 2));
  assert.equal((await storage.getUserStreak()).current_streak, 0);
  storage.setStorageAccountId('A'); assert((await storage.getSyncQueue()).length > 0);
  console.log('PASS: sync token bound to original account, no arbitrary RPC user ID, both queues retained across account switch.');
}
async function browserTests() {
  const forged = new Map([['ingly_admin_session', JSON.stringify({ role: 'super_admin' })], ['ingly_admin_auth_v2', 'forged-token']]);
  const store = { getItem: k => forged.get(k) ?? null, removeItem: k => forged.delete(k), setItem: (k, v) => forged.set(k, v) };
  let valid = false, rpcCalls = 0;
  const client = { auth: {
    getUser: async () => valid ? { data: { user: { id: 'A' } }, error: null } : { data: { user: null }, error: new Error('Invalid JWT') },
  }, rpc: async () => { rpcCalls++; return { data: null, error: new Error('No role') }; } };
  const context = { window: { supabase: { createClient: () => client } }, localStorage: store, sessionStorage: store };
  vm.runInNewContext(read('admin/public/auth.js'), context);
  await assert.rejects(context.window.inglyAuth.authorize()); assert.equal(rpcCalls, 0);
  valid = true; await assert.rejects(context.window.inglyAuth.authorize()); assert.equal(rpcCalls, 1);
  assert(!forged.has('ingly_admin_session'));
  console.log('PASS: fabricated browser session and real non-admin session cannot authorize admin access.');
}
async function endpointTests() {
  let handler; let verified = false; let role = null; let privileged = null; let privilegeError = null; let mutations = 0;
  const server = {
    auth: { getUser: async () => ({ data: { user: verified ? { id: 'actor' } : null }, error: null }) },
    from: table => {
      let cols = '';
      const q = { select: s => { cols = s; return q; }, eq: () => q,
        single: async () => ({ data: table === 'admins' ? role : cols === 'id,is_blocked' ? { id: 'actor', is_blocked: false } : { id: 'target-row', auth_user_id: 'target' }, error: null }),
        maybeSingle: async () => ({ data: privileged, error: privilegeError }),
        update: () => { mutations++; return q; }, insert: () => { mutations++; return q; },
      }; return q;
    },
  };
  moduleAt('backend/supabase/functions/admin-accounts/index.ts', { 'npm:@supabase/supabase-js@2.117.2': { createClient: () => server } }, {
    Deno: { env: { get: () => 'test-only' }, serve: h => { handler = h; } }, Request, Response,
  });
  const invoke = action => handler(new Request('http://test.local', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: JSON.stringify({ action, payload: { id: 'target-row', password: 'secret' } }) }));
  assert.equal((await invoke('resetPassword')).status, 401);
  verified = true; assert.equal((await invoke('resetPassword')).status, 403);
  assert.equal((await invoke('updateUser')).status, 403);
  role = { id: 'editor', role: 'editor', permissions: ['manage_words'], is_active: true };
  assert.equal((await invoke('resetPassword')).status, 403);
  role.permissions = ['manage_users']; assert.equal((await invoke('createAdmin')).status, 403);
  privileged = { id: 'admin-target', role: 'editor' };
  assert.equal((await invoke('resetPassword')).status, 403);
  assert.equal((await invoke('deleteUser')).status, 403);
  assert.equal((await invoke('updateUser')).status, 403); assert.equal(mutations, 0);
  privileged = null; privilegeError = new Error('database unavailable');
  assert.equal((await invoke('resetPassword')).status, 503);
  assert.equal((await invoke('deleteUser')).status, 503); assert.equal(mutations, 0);
  console.log('PASS: edge handler rejects unverified tokens, non-admins, unauthorized editors, and moderator attacks on admins.');
}
function adminRenderTests() {
  for (const file of ['admin/index.html', 'admin/preview.html']) {
    const script = [...read(file).matchAll(/<script\b[^>]*type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)][0][1];
    const code = babel.transformSync(script, { babelrc: false, configFile: false,
      plugins: [require.resolve('../mobile/node_modules/@babel/plugin-transform-react-jsx')] }).code;
    for (const tab of ['login','dashboard','users','words','finance','admins','settings']) {
      let hook = 0;
      const React = { useEffect: () => {}, useState: initial => {
        const i = hook++; let value = typeof initial === 'function' ? initial() : initial;
        if (i === 0) value = tab !== 'login';
        if (i === 5) value = { id: 'admin', name: 'Verified', role: 'super_admin', permissions: [] };
        if (value === 'dashboard' && tab !== 'login') value = tab;
        return [value, () => {}];
      }, createElement: (type, props, ...children) => ({ type, props, children }) };
      const store = { getItem: () => null, removeItem: () => {}, setItem: () => {} };
      const context = { React, ReactDOM: { createRoot: () => ({ render: () => {} }) },
        document: { getElementById: () => ({}) }, localStorage: store, sessionStorage: store,
        window: { inglyAuth: { url: 'fixed', anonKey: 'public' } }, console, Date, Map, Set };
      vm.runInNewContext(code + '\nApp();', context, { filename: file });
    }
  }
  console.log('PASS: both admin entrypoints render login and authorized tabs without removed-auth runtime references.');
}
async function settingsTests() {
  let stored;
  const settings = moduleAt('mobile/src/services/appSettingsService.js', {
    './supabaseClient': { isSupabaseConfigured: () => false },
    './storage': { getStorageAccountId: () => 'A',
      getStorageItem: async () => ({ ads_enabled: true, card_receiver_number: '8600000000000000', password_hash: 'old-private-value' }),
      setStorageItem: async (_key, value) => { stored = value; },
    },
  });
  await settings.initAppSettings();
  assert(stored.ads_enabled); assert(!('card_receiver_number' in stored)); assert(!('password_hash' in stored));
  console.log('PASS: old settings cache is sanitized; no merchant card number or unexpected private fields are re-persisted.');
}
function importTests() {
  const files = [];
  function scan(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name); if (e.isDirectory()) scan(f); else if (/\.(js|jsx)$/.test(f)) files.push(f);
  } }
  scan(path.join(root, 'mobile/src')); scan(path.join(root, 'admin/src')); files.push(path.join(root, 'mobile/App.js'));
  const asts = new Map(files.map(f => [f, parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] })]));
  for (const [f, tree] of asts) for (const n of tree.program.body) {
    if (n.type !== 'ImportDeclaration') continue;
    const name = n.source.value;
    if (!name.startsWith('.')) {
      if (!name.startsWith('@shared')) require.resolve(name, { paths: [path.dirname(f)] });
      continue;
    }
    const base = path.resolve(path.dirname(f), name);
    const target = ['', '.js', '.jsx', '.json', '/index.js'].map(s => base + s).find(s => fs.existsSync(s));
    assert(target, f + ': ' + name);
    const imported = asts.get(target); if (!imported) continue;
    const names = new Set();
    for (const entry of imported.program.body) {
      if (entry.type === 'ExportDefaultDeclaration') names.add('default');
      if (entry.type === 'ExportNamedDeclaration') {
        for (const s of entry.specifiers || []) names.add(s.exported.name);
        const decl = entry.declaration;
        if (decl?.id?.name) names.add(decl.id.name);
        for (const d of decl?.declarations || []) if (d.id.name) names.add(d.id.name);
      }
    }
    for (const spec of n.specifiers) if (spec.type !== 'ImportNamespaceSpecifier') {
      const importedName = spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.imported.name;
      assert(names.has(importedName), f + ': missing export ' + importedName + ' in ' + name);
    }
  }
  console.log('PASS: mobile/admin JS syntax, direct package imports, relative paths and named exports.');
}
function staticTests() {
  const sql = read('backend/migrations/20261005_security_phase2.sql');
  assert(sql.startsWith('-- Security Phase 2')); assert(sql.includes('BEGIN;')); assert(sql.endsWith('COMMIT;\n'));
  assert.equal((sql.match(/SECURITY DEFINER/g) || []).length, 7);
  assert.equal((sql.match(/SECURITY DEFINER SET search_path = ''/g) || []).length, 7);
  assert(!/GRANT\s+EXECUTE[\s\S]*?TO\s+(?:PUBLIC|anon)\s*;/i.test(sql));
  for (const name of ['verify_user_credentials(TEXT,TEXT)', 'set_user_password_secure(UUID,TEXT,TEXT)', 'get_safe_user_status(TEXT)', 'sync_user_offline_progress(UUID,JSONB)', 'record_user_activity(UUID,INT)'])
    assert(sql.includes('DROP FUNCTION IF EXISTS public.' + name));
  assert(sql.includes('FROM PUBLIC, anon, authenticated')); assert(sql.includes('DROP POLICY %I'));
  assert(sql.includes('user_id=auth.uid()')); assert(sql.includes('p_user_id UUID := auth.uid()'));
  assert(sql.includes('security_invoker = true')); assert(sql.includes('ALTER PUBLICATION supabase_realtime DROP TABLE'));
  assert(!/GRANT (?:ALL|SELECT|UPDATE) ON (?:TABLE )?public.users TO authenticated/.test(sql));
  const publicSettings = sql.split('CREATE POLICY public_settings')[1].split('CREATE POLICY admin_settings')[0];
  assert(!publicSettings.includes('transactions_data')); assert(!publicSettings.includes('leaderboard_scores'));
  const schema = read('backend/schema.sql');
  assert(schema.startsWith('BEGIN;')); assert(schema.endsWith('COMMIT;\n'));
  assert(schema.endsWith(sql.replace('BEGIN;\n', '')));
  assert(!schema.includes("'Joji'"));
  for (const f of ['admin/index.html', 'admin/preview.html']) {
    const html = read(f); assert(!html.includes('password_hash')); assert(!html.includes('admin123')); assert(!html.includes('hashPassword'));
    assert(!html.includes('${supabaseUrl')); assert(html.includes('window.inglyAuth.manage'));
  }
  const payment = read('mobile/src/components/PaymentModal.js');
  parser.parse(payment, { sourceType: 'module', plugins: ['jsx'] });
  assert(!/setStorageItem|SAVED_CARDS|AsyncStorage|localStorage|rawNumber/.test(payment));
  assert(payment.includes('TEST/MOCK')); assert(payment.includes('__DEV__')); assert(payment.includes('mock: true'));
  const user = read('mobile/src/context/UserContext.js');
  assert(!user.includes("utils/crypto")); assert(user.includes('Google OAuth is disabled.'));
  assert(!/recordTransaction\(|is_premium:\s*true/.test(user));
  assert(read('mobile/App.js').includes('key={user.id}'));
  assert(read('mobile/src/screens/MyWordsScreen.js').includes('}, session)'));
  console.log('PASS: SQL ownership/grant/search-path static invariants, retired RPC signatures, no client hashes/default admin, no card persistence, disabled Google/mock production entitlements.');
}
(async () => {
  const storage = await storageTests(); await authTests(); await syncTests(storage); await settingsTests();
  await browserTests(); await endpointTests(); adminRenderTests(); importTests(); staticTests();
  console.log('REQUIRES DEPLOYED SUPABASE VERIFICATION: actual SQL execution, RLS/CLS behavior, Auth/SMS, Edge Function deployment.');
})().catch(error => { console.error(error); process.exitCode = 1; });
