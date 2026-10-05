const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const settle = () => new Promise(resolve => setImmediate(resolve));
const snapshot = { total_users: 0, dau: 0, mastered_words: 0, active_streak_users: 0, weekly_growth_pct: null,
  current_week_new_users: 0, previous_week_new_users: 0, timezone: 'Asia/Tashkent',
  activity_tracking_started_at: '2026-10-05T00:00:00Z', generated_at: '2026-10-05T01:00:00Z',
  books: [{ book: 1, title: 'Book 1', unit_count: 30, word_count: 600, learners: 0, mastered_pairs: 0 }], config: { premium_mode_enabled: true, free_book_ids: [1] } };
const ledger = { income: 0, expenses: 0, net_profit: 0, purchase_count: 0, matched_count: 0,
  counts: { all: 0, income: 0, expense: 0, vip: 0, book: 0 }, rows: [], generated_at: '2026-10-05T01:00:00Z' };
function browser() {
  let event; let response = { data: snapshot, error: null };
  let session = { user: { id: 'A' }, access_token: 'jwt-A' };
  let access = { auth_user_id: 'A' };
  let beforeAuthorize = null;
  const calls = [];
  const client = { auth: { onAuthStateChange(fn) { event = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    async getSession() { return { data: { session }, error: null }; } },
    rpc(name, args) {
      const call = { name, args }; calls.push(call);
      return { setHeader(key, value) { call.header = [key, value]; return this; }, abortSignal(signal) { call.signal = signal; return this; },
        then(resolve, reject) { return Promise.resolve(typeof response === 'function' ? response(call) : response).then(resolve, reject); } };
    } };
  const window = { inglyAuth: { client, async authorize() { if (beforeAuthorize) await beforeAuthorize(); if (!access) throw new Error('Denied'); return access; } } };
  const context = { window, console, AbortController, setTimeout, clearTimeout, Date, Set, JSON };
  vm.runInNewContext(read('admin/public/real-data.js'), context);
  return { window, model: window.inglyRealData, calls,
    respond(value) { response = value; }, authorize(fn) { beforeAuthorize = fn; },
    deny() { access = null; }, mismatch() { access = { auth_user_id: 'B' }; },
    change(id, jwt = 'jwt-' + id) { session = { user: { id }, access_token: jwt }; access = { auth_user_id: id }; event?.('SIGNED_IN', session); } };
}
function renderer(b, name) {
  const values = [], refs = [], effects = [];
  let index = 0, initial = true, tree;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initialValue) { const key = index++; if (initial) values[key] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [values[key], value => { values[key] = typeof value === 'function' ? value(values[key]) : value; }]; },
    useRef(value) { const key = index++; if (initial) refs[key] = { current: value }; return refs[key]; },
    useCallback(fn) { return fn; }, useEffect(fn) { if (initial) effects.push(fn); }
  };
  b.window.React = React; b.window.prompt = () => 'Correction';
  vm.runInNewContext(read('admin/public/real-data-ui.js'), { window: b.window, setTimeout, clearTimeout, console, Date,
    crypto: { randomUUID: () => 'c029466c-81c1-480c-a995-e51360b8ac38' }, URL, Blob });
  const render = () => { index = 0; tree = b.window.inglyRealUI[name]({}); initial = false; return tree; };
  render();
  const cleanups = effects.map(fn => fn()).filter(Boolean);
  const expand = node => {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, children: node.children.map(expand) };
  };
  const nodes = tree => {
    const result = [];
    const walk = node => { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object') { result.push(node); node.children?.forEach(walk); } };
    walk(expand(tree)); return result;
  };
  const text = node => { if (Array.isArray(node)) return node.map(text).join(' '); if (node == null || typeof node === 'boolean') return ''; return typeof node === 'object' ? text(node.children) : String(node); };
  return { render, nodes, text: () => text(expand(render())), cleanup: () => cleanups.forEach(fn => fn()) };
}
function validEntry() { return { request_id: 'c029466c-81c1-480c-a995-e51360b8ac38', reference: 'DOC-1', type: 'income',
  amount: 29000, currency: 'UZS', category: 'other', title: 'Real manual accounting', description: '',
  payment_method: 'cash', occurred_at: new Date().toISOString(), environment: 'production' }; }

test('both shipped HTML entrypoints use shared real Dashboard/Finance/Monetization and never legacy finance blobs', () => {
  for (const file of ['admin/index.html','admin/preview.html']) {
    const html = read(file);
    for (const script of ['real-data.js','real-data-ui.js']) assert(html.includes(`src="/${script}"`));
    for (const component of ['RealDashboard','RealFinance','RealMonetization']) assert(html.includes('<' + component));
    for (const obsolete of ['3,240','14,850','184,520','2,890','transactions_data','setTransactions','handleSaveTransaction']) assert(!html.includes(obsolete), obsolete);
    assert(!html.includes('100% Bepul & Reklamasiz Rejim'));
  }
  assert(!read('admin/src/pages/DashboardPage.jsx').includes('mockStats'));
  assert(!read('admin/src/pages/MonetizationPage.jsx').includes('mockFeatureFlags'));
});
test('catalog is verified against actual bundled IDs, book titles, units and all admin copies', () => {
  const words = JSON.parse(read('mobile/src/data/all_words.json'));
  assert.equal(words.length, 3600);
  assert.deepEqual(words.map(w => w.id).sort((a,b) => a-b), Array.from({ length: 3600 }, (_,i) => i+1));
  for (let book = 1; book <= 6; book++) {
    const entries = words.filter(w => w.book === book);
    assert.equal(entries.length, 600); assert.equal(new Set(entries.map(w => w.unit)).size, 30);
    for (const w of entries) { assert.equal(Math.floor((w.id-1)/600)+1, w.book); assert.equal(Math.floor((w.id-1)%600/20)+1, w.unit); }
  }
  for (const file of ['admin/all_words.json','admin/public/all_words.json']) assert.deepEqual(JSON.parse(read(file)), words);
  const titles = [...read('mobile/src/data/sampleData.js').matchAll(/title: '(Book [1-6] - [^']+)'/g)].map(m => m[1]);
  for (const title of titles.slice(0,6)) assert(read('backend/migrations/20261006_admin_real_data.sql').includes(title));
});
test('book access follows persisted VIP/free IDs including empty and non-contiguous IDs', () => {
  const { accessState } = browser().model;
  assert.equal(accessState({ premium_mode_enabled: false }, 6), true);
  assert.equal(accessState({ premium_mode_enabled: true, free_book_ids: [1,3] }, 2), false);
  assert.equal(accessState({ premium_mode_enabled: true, free_book_ids: [1,3] }, 3), true);
  assert.equal(accessState({ premium_mode_enabled: true, free_book_ids: [], free_books_count: 6 }, 1), true);
  assert.equal(accessState({ premium_mode_enabled: true, free_book_ids: [1,3], free_books_count: 1 }, 2), false);
  assert.equal(accessState({}, 1), null);
  assert.equal(accessState({ premium_mode_enabled: true }, 1), null);
  assert.equal(accessState({ premium_mode_enabled: 'true', free_book_ids: '[1]' }, 2), false);
});
test('dashboard renders honest zero and unavailable growth without fallback demo or Cinema claims', async () => {
  const b = browser(), r = renderer(b, 'Dashboard'); await settle();
  const text = r.text(); assert(text.includes('0')); assert(text.includes('yetarli ma’lumot')); assert(!text.includes('4000'));
  assert(!/Harry Potter|Cinema|15-20 MB/.test(text)); assert.equal(b.calls[0].name, 'admin_dashboard_snapshot'); r.cleanup();
});
test('dashboard growth displays real server values, including negative growth', async () => {
  const b = browser(); b.respond({ data: { ...snapshot, weekly_growth_pct: -50, current_week_new_users: 2, previous_week_new_users: 4 }, error: null });
  const r = renderer(b, 'Dashboard'); await settle(); assert(r.text().includes('-50%')); r.cleanup();
});
test('unauthorized analytics and failed RPC render unavailable, never zero success', async () => {
  const b = browser(); b.deny(); const r = renderer(b, 'Dashboard'); await settle(); assert(r.text().includes('Denied')); assert.equal(b.calls.length, 0); r.cleanup();
  const other = browser(); other.respond({ data: null, error: { message: '42501 authorization rejected' } });
  await assert.rejects(other.model.api.dashboard(), /authorization rejected/);
});
test('RPC captures original session JWT and rejects mismatched verified identity', async () => {
  const b = browser(); await b.model.api.dashboard(); assert.deepEqual(b.calls[0].header, ['Authorization','Bearer jwt-A']);
  assert.equal(b.calls[0].signal.aborted, false); const other = browser(); other.mismatch();
  await assert.rejects(other.model.api.dashboard(), /sessiyasi/); assert.equal(other.calls.length, 0);
});
test('A to B to A before RPC invalidates old authorization even with same owner', async () => {
  const b = browser(); let resolve; b.authorize(() => new Promise(r => { resolve = r; }));
  const promise = b.model.api.dashboard(); await settle(); b.change('B'); b.change('A', 'new-jwt-A'); resolve();
  await assert.rejects(promise, /sessiyasi/); assert.equal(b.calls.length, 0);
});
test('in-flight result from an old admin generation cannot return private data', async () => {
  const b = browser(); let resolve; b.respond(() => new Promise(r => { resolve = r; }));
  const promise = b.model.api.dashboard(); await settle(); b.change('B'); resolve({ data: snapshot, error: null });
  await assert.rejects(promise, /sessiyasi/);
});
test('finance requests use bounded server paging/filter/search, production by default', async () => {
  const b = browser(); b.respond({ data: ledger, error: null }); await b.model.api.finance({ filter: 'book', search: 'Hujjat', before: { id: 'UUID', occurred_at: 'DATE' } });
  const call = b.calls[0]; assert.equal(call.name, 'admin_finance_snapshot'); assert.equal(call.args.p_environment, 'production');
  assert.equal(call.args.p_limit, 50); assert.equal(call.args.p_filter, 'book'); assert.equal(call.args.p_search, 'Hujjat');
  assert.equal(call.args.p_before_id, 'UUID'); assert.equal(call.args.p_before_date, 'DATE');
});
test('finance empty state and cards use server aggregates without private table downloads', async () => {
  const b = browser(); b.respond({ data: { ...ledger, income: 100, expenses: 30, net_profit: 70, purchase_count: 0 }, error: null });
  const r = renderer(b, 'Finance'); await settle(); const text = r.text();
  assert(text.includes('Hozircha moliyaviy operatsiyalar mavjud emas.')); assert(text.includes('100')); assert(text.includes('70')); assert(text.includes('transactions_data')); r.cleanup();
});
test('test and mock views are explicit and do not silently switch production totals', async () => {
  const b = browser(); b.respond({ data: ledger, error: null }); const r = renderer(b, 'Finance'); await settle();
  const select = r.nodes(r.render()).find(n => n.type === 'select'); select.props.onChange({ target: { value: 'mock' } });
  assert(r.text().includes('TEST / MOCK ko‘rinishi')); await b.model.api.finance({ environment: 'mock' });
  assert.equal(b.calls[b.calls.length-1].args.p_environment, 'mock'); r.cleanup();
});
test('manual input validation rejects invalid types, amount, currency, category, method and date', () => {
  const validate = browser().model.validateManualEntry;
  for (const patch of [{ type: 'credit' },{ amount: 0 },{ amount: -1 },{ amount: 1.5 },{ amount: Infinity },{ amount: 1e13 },
    { currency: 'USD' },{ category: 'unknown' },{ title: ' ' },{ payment_method: 'card_secret' },{ environment: 'live' },
    { occurred_at: 'bad' },{ occurred_at: '2026-01-01T10:00:00' },{ reference: '' }]) assert.throws(() => validate({ ...validEntry(), ...patch }));
  assert.equal(validate(validEntry()).amount, 29000);
});
test('manual client payload allowlist cannot smuggle purchase, card, role, token or related-user fields', async () => {
  const b = browser(); b.respond({ data: { success: true, id: validEntry().request_id }, error: null });
  await b.model.api.create({ ...validEntry(), is_purchase: true, source: 'verified_provider', cvv: '123', role: 'super_admin', access_token: 'secret', related_user_id: 'B' });
  const entry = b.calls[0].args.p_entry;
  for (const key of ['is_purchase','source','cvv','role','access_token','related_user_id']) assert(!(key in entry));
});
test('failed/manual unconfirmed responses cannot report success or emit refresh', async () => {
  const b = browser(); const changes = []; b.model.api.subscribe(kind => changes.push(kind));
  b.respond({ data: null, error: { message: 'Denied write' } }); await assert.rejects(b.model.api.create(validEntry()), /Denied write/);
  b.respond({ data: {}, error: null }); await assert.rejects(b.model.api.create(validEntry()), /tasdiqlanmadi/);
  b.respond({ data: { success: true, id: 'wrong' }, error: null }); await assert.rejects(b.model.api.create(validEntry()), /tasdiqlanmadi/); assert.equal(changes.length, 0);
});
test('manual retries retain exact request identity and payload', async () => {
  const b = browser(); b.respond({ data: null, error: { message: 'Network' } }); const entry = validEntry();
  await assert.rejects(b.model.api.create(entry)); b.respond({ data: { success: true, id: entry.request_id, replayed: true }, error: null });
  await b.model.api.create(entry); assert.equal(JSON.stringify(b.calls[0].args), JSON.stringify(b.calls[1].args));
});
test('void uses authorized RPC, requires reason, checks exact confirmation and refreshes only on success', async () => {
  const b = browser(); const changes = []; b.model.api.subscribe(kind => changes.push(kind));
  await assert.rejects(b.model.api.void('ID', ' ')); assert.equal(b.calls.length, 0);
  b.respond({ data: { success: true, id: 'wrong' }, error: null }); await assert.rejects(b.model.api.void('ID', 'Reason'));
  b.respond({ data: { success: true, id: 'ID' }, error: null }); await b.model.api.void('ID', 'Reason');
  assert.equal(b.calls[0].name, 'admin_void_finance_entry'); assert.deepEqual(changes, ['finance']);
});
test('export uses complete canonical filtered query in one bounded snapshot, not sample/current-page rows', async () => {
  const b = browser(); b.respond({ data: { ...ledger, matched_count: 1, rows: [{ id: 'REAL', amount: 19, title: 'O‘zbekcha', status: 'completed' }] }, error: null });
  const csv = await b.model.api.export({ environment: 'production', filter: 'vip', search: 'O‘zbekcha' });
  assert(csv.includes('REAL')); assert(csv.includes('O‘zbekcha')); assert.equal(csv.charCodeAt(0), 0xfeff);
  const args = b.calls[0].args; assert.equal(args.p_filter, 'vip'); assert.equal(args.p_search, 'O‘zbekcha'); assert.equal(args.p_limit, 2000); assert.equal(args.p_before_id, null);
  b.respond({ data: { ...ledger, matched_count: 2001 }, error: null }); await assert.rejects(b.model.api.export({}), /2 000/);
});
test('CSV allowlist excludes unrelated PII/secrets, preserves Unicode/quotes and neutralizes spreadsheet formulas', () => {
  const { exportCSV } = browser().model;
  const csv = exportCSV([{ id: 'ID', title: '=HYPERLINK("bad")', description: 'O‘zbekcha, "izoh"\nIkki', reference: '@formula',
    amount: 29000, cvv: 'SECRET_CVV', password: 'SECRET_PASSWORD', access_token: 'SECRET_TOKEN', related_user_id: 'PRIVATE_UUID', card_number: 'SECRET_CARD' }]);
  for (const secret of ['SECRET_CVV','SECRET_PASSWORD','SECRET_TOKEN','PRIVATE_UUID','SECRET_CARD']) assert(!csv.includes(secret));
  assert(csv.includes("'=HYPERLINK")); assert(csv.includes("'@formula")); assert(csv.includes('""izoh""')); assert(csv.includes('O‘zbekcha'));
});
test('configuration has a separate manage-settings read boundary and checks committed writes', async () => {
  const b = browser(); let confirmedConfig;
  b.model.api.subscribe((kind, config) => { if (kind === 'configuration') confirmedConfig = config; });
  b.respond({ data: { books: [], config: { premium_mode_enabled: true } }, error: null });
  await b.model.api.configuration(); assert.equal(b.calls[0].name, 'admin_configuration_snapshot');
  b.respond({ data: { success: true, config: { free_book_ids: [1,3], free_books_count: 1 } }, error: null });
  const result = await b.model.api.configure({ free_book_ids: [1,3] }); assert.equal(result.free_books_count, 1);
  assert.equal(confirmedConfig, result);
  assert(read('backend/migrations/20261006_admin_real_data.sql').includes('coalesce(min(n)-1,6)'));
  b.respond({ data: {}, error: null }); await assert.rejects(b.model.api.configure({}), /tasdiqlanmadi/);
});
test('old rendered finance handler cannot create or export under a replacement admin', async () => {
  const b = browser(); b.respond({ data: ledger, error: null }); const r = renderer(b, 'Finance'); await settle();
  const oldTree = r.render(); const exportButton = r.nodes(oldTree).find(n => n.type === 'button' && r.nodes(n).length && n.children.includes('CSV / Excel uchun eksport'));
  assert(exportButton); const calls = b.calls.length; b.change('B'); exportButton.props.onClick(); await settle();
  assert(!b.calls.slice(calls).some(call => call.args.p_limit === 2000 || call.name === 'admin_create_finance_entry')); r.cleanup();
});
test('invalid/missing/unsafe aggregate responses fail closed instead of showing inaccurate numbers', async () => {
  const b = browser(); b.respond({ data: { ...snapshot, dau: null }, error: null }); await assert.rejects(b.model.api.dashboard());
  b.respond({ data: { ...ledger, income: Number.MAX_SAFE_INTEGER + 1 }, error: null }); await assert.rejects(b.model.api.finance());
});
test('SQL static analytics invariants: Auth population, Tashkent windows, zero denominator, unique canonical pairs and streak freshness', () => {
  const sql = read('backend/migrations/20261006_admin_real_data.sql');
  assert(sql.includes('JOIN auth.users a ON a.id=u.auth_user_id AND u.id=a.id'));
  assert(sql.includes("a.created_at")); assert(sql.includes("AT TIME ZONE 'Asia/Tashkent'"));
  assert(sql.includes('today-6')); assert(sql.includes('today-13')); assert(sql.includes('CASE WHEN r.previous_week=0 THEN NULL'));
  assert(sql.includes('JOIN public.admin_course_catalog c')); assert(sql.includes('UNION\n'));
  assert(sql.includes("e.entity_key='word:'||c.word_id")); assert(!sql.includes("sum((e.payload->>'totalWordsLearned')"));
  assert(sql.includes('PRIMARY KEY(user_id,activity_day)')); assert(sql.includes('AFTER INSERT ON public.learning_sync_receipts'));
  assert(sql.includes("IN (today::TEXT,(today-1)::TEXT)"));
});
test('SQL static finance invariants: production default, completed totals, verified-only purchases, atomic idempotency and audited void', () => {
  const sql = read('backend/migrations/20261006_admin_real_data.sql');
  assert(sql.includes("p_environment TEXT DEFAULT 'production'")); assert(sql.includes('WHERE environment=p_environment'));
  assert(sql.includes("type='income' AND status='completed' AND is_purchase AND source='verified_provider'"));
  assert(sql.includes('income-expenses')); assert(sql.includes('UNIQUE(source,environment,reference)'));
  assert(sql.includes('ON CONFLICT DO NOTHING RETURNING * INTO row')); assert(sql.includes('ON CONFLICT(source,environment,reference) DO NOTHING'));
  assert(sql.includes('row.recorded_status IS DISTINCT FROM')); assert(sql.includes("SET status='voided',voided_at=now(),voided_by=auth.uid()"));
  assert(!sql.includes('DELETE FROM public.finance_ledger')); assert(sql.includes('FOR UPDATE'));
  assert(sql.includes('INSERT INTO public.finance_audit')); assert(sql.includes("'completed','completed',p_entry->>'environment','manual',auth.uid()"));
});
test('SQL static security: explicit live authorization, no client table grants, safe paths and service-only provider writes', () => {
  const sql = read('backend/migrations/20261006_admin_real_data.sql');
  assert(sql.startsWith('-- Admin')); assert(sql.includes('BEGIN;')); assert(sql.endsWith('COMMIT;\n'));
  assert.equal((sql.match(/SECURITY DEFINER/g) || []).length, (sql.match(/SECURITY DEFINER SET search_path = ''/g) || []).length);
  for (const permission of ['view_stats','view_analytics','manage_settings','view_finance','manage_finance']) assert(sql.includes(`has_permission('${permission}')`));
  assert(sql.includes("auth.role() IS DISTINCT FROM 'service_role'"));
  assert(!/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\s+ON.*TO authenticated/.test(sql));
  assert(sql.includes('ENABLE ROW LEVEL SECURITY')); assert(sql.includes('FROM PUBLIC, anon, authenticated'));
  const grant = sql.split('GRANT EXECUTE ON FUNCTION public.admin_dashboard_snapshot()')[1].split('TO authenticated;')[0];
  assert(!grant.includes('record_verified_finance_purchase'));
  assert(sql.includes('GRANT EXECUTE ON FUNCTION public.record_verified_finance_purchase(JSONB) TO service_role'));
});
test('no expensive polling, private persistence, mobile transaction wiring or public-table count downloads added', () => {
  for (const file of ['admin/public/real-data.js','admin/src/components/RealDataPanels.jsx']) {
    const source = read(file); assert(!/setInterval|localStorage|sessionStorage|(?:client|supabase)\.from\(/.test(source));
  }
  assert(!read('mobile/src/context/UserContext.js').includes('record_verified_finance_purchase'));
  assert(!read('admin/public/real-data.js').includes('record_verified_finance_purchase'));
});
test('generated shared UI is current and both alternate routes load the same implementation', () => {
  cp.execFileSync(process.execPath, [path.join(root, 'admin/scripts/build-real-data.cjs'), '--check']);
  assert(read('admin/src/App.jsx').includes("case 'finances'")); assert(read('admin/src/pages/FinancePage.jsx').includes('<Finance'));
  assert(!read('admin/src/components/layout/Sidebar.jsx').includes('14.8k'));
});
test('rollback staging tests exercise actual SQL totals, duplicate receipts, unauthorized access and void audit (not executed locally)', () => {
  const sql = read('backend/tests/admin_real_data.sql');
  for (const call of ['sync_learning_operations','admin_dashboard_snapshot','admin_finance_snapshot','admin_create_finance_entry','admin_void_finance_entry','record_verified_finance_purchase']) assert(sql.includes('public.' + call));
  assert(sql.includes('ASSERT')); assert(sql.endsWith('ROLLBACK;\n')); assert(sql.includes('WHEN insufficient_privilege'));
});

(async () => {
  let failed = 0;
  for (const [name, run] of tests) {
    try { await run(); console.log('PASS: ' + name); }
    catch (error) { failed++; console.error('FAIL: ' + name); console.error(error); }
  }
  console.log(`ADMIN REAL DATA: ${tests.length-failed} PASS, ${failed} FAIL.`);
  console.log('SQL assertions above are static. PostgreSQL/RLS/staging integration tests have NOT been executed.');
  process.exitCode = failed ? 1 : 0;
})();
