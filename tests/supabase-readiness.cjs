// Local lexical/static and mocked Auth checks only. No SQL execution/network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const parser = require('../mobile/node_modules/@babel/parser');
const root = path.resolve(__dirname, '..');
const { browserEnvironment } = require('./helpers/environment.cjs');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const migrations = ['20261005_security_phase2.sql','20261005_repair_phase3_offline_sync.sql','20261006_admin_real_data.sql'];
const sql = migrations.map(f => read('backend/migrations/' + f));
const tests = [];
const test = (name, run) => tests.push([name, run]);

// Recognize statement boundaries, strings, dollar bodies and nested comments.
// This catches truncated/unbalanced SQL, NOT PostgreSQL grammar/PLpgSQL compilation.
function statements(source) {
  const result = []; let code = '', quote = null, dollar = null, comment = 0, line = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], pair = source.slice(i,i+2);
    if (line) { if (ch === '\n') { line = false; code += '\n'; } continue; }
    if (comment) { if (pair === '/*') { comment++; i++; } else if (pair === '*/') { comment--; i++; } continue; }
    if (dollar) { if (source.startsWith(dollar,i)) { code += dollar; i += dollar.length-1; dollar = null; } else code += ch; continue; }
    if (quote) { code += ch; if (ch === quote) { if (source[i+1] === quote) code += source[++i]; else quote = null; } continue; }
    if (pair === '--') { line = true; i++; code += ' '; continue; }
    if (pair === '/*') { comment = 1; i++; code += ' '; continue; }
    if (ch === "'" || ch === '"') { quote = ch; code += ch; continue; }
    if (ch === '$') { const match = source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/);
      if (match) { dollar = match[0]; code += dollar; i += dollar.length-1; continue; } }
    if (ch === ';') { if (code.trim()) result.push(code.trim()); code = ''; } else code += ch;
  }
  assert(!quote && !dollar && !comment, 'Unterminated SQL quote/body/comment');
  assert(!code.trim(), 'SQL statement missing final semicolon');
  return result;
}
test('SQL boundary check rejects truncated bodies and preserves embedded semicolons', () => {
  assert.throws(() => statements('DO $$ BEGIN; END;'));
  assert.throws(() => statements("SELECT 'broken;"));
  assert.throws(() => statements('SELECT 1'));
  assert.equal(statements("/* outer /* inner */ */ DO $tag$ BEGIN PERFORM ';'; END $tag$; SELECT 1;").length,2);
});
test('migrations each have one transaction and no top-level data/table destruction', () => {
  for (const source of sql) {
    const items = statements(source);
    assert.equal(items[0],'BEGIN'); assert.equal(items.at(-1),'COMMIT');
    assert.equal(items.filter(s => /^(BEGIN|COMMIT)$/.test(s)).length,2);
    assert(!items.some(s => /^(?:DROP\s+(?:TABLE|SCHEMA)|TRUNCATE|DELETE\s+FROM)/i.test(s)));
    assert(!/DROP\s+[^;]*\bCASCADE\s*;/i.test(source));
  }
});
test('actual dependencies enforce Phase 2 -> Phase 3 -> admin real data', () => {
  assert(sql[0].includes('FUNCTION ingly_private.active_account()'));
  assert(sql[0].includes('FUNCTION ingly_private.has_permission(permission TEXT)'));
  assert(sql[1].includes('ingly_private.active_account()'));
  assert(sql[1].includes('CREATE TABLE IF NOT EXISTS public.learning_sync_receipts'));
  assert(sql[2].includes('AFTER INSERT ON public.learning_sync_receipts'));
  assert(sql[2].includes('FROM public.learning_sync_entities'));
  assert(read('backend/schema.sql').endsWith(sql[0].replace('BEGIN;\n','')));
});
test('every created function revokes PUBLIC/anon and every definer has an empty search_path', () => {
  for (const source of sql) {
    const items = statements(source);
    for (const stmt of items.filter(s => /^CREATE (?:OR REPLACE )?FUNCTION /i.test(s))) {
      const name = stmt.match(/^CREATE (?:OR REPLACE )?FUNCTION ([\w.]+)\(/i)[1];
      const revoked = items.some(s => /^REVOKE ALL ON FUNCTION /i.test(s) && s.includes(name+'(')
        && /FROM PUBLIC, anon, authenticated$/i.test(s));
      assert(revoked, name + ' missing explicit revoke');
      if (/SECURITY DEFINER/i.test(stmt)) {
        assert(stmt.includes("SET search_path = ''"), name);
        assert(/RETURNS TRIGGER/i.test(stmt) || /auth\.uid\(\)|auth\.role\(\)/.test(stmt), name + ' missing caller check');
      }
    }
    assert(!items.some(s => /^GRANT .*EXECUTE/i.test(s) && /TO (?:PUBLIC|anon)\b/i.test(s)));
  }
});
test('Phase 3 retirement is recognized by the read-only Phase 2 verifier', () => {
  const source = read('backend/verify_security_phase2.sql');
  assert(source.includes("to_regprocedure('public.read_learning_sync(bigint)')"));
  assert(source.includes('IS DISTINCT FROM (NOT phase3)'));
  assert(source.includes('Incomplete Phase 3 migration'));
  assert(sql[1].includes('REVOKE EXECUTE ON FUNCTION public.sync_user_offline_progress(JSONB), public.record_user_activity(INT) FROM PUBLIC, anon, authenticated'));
});
test('Phase 3 rerun removes additive policies/column grants and keeps preference writes inside baseline constraints', () => {
  const source=sql[1];
  assert(source.includes('FROM pg_policies WHERE schemaname=\'public\' AND tablename=t'));
  assert(source.includes('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I)'));
  assert(source.includes("USING (user_id=auth.uid() AND ingly_private.active_account())"));
  assert(source.includes('GREATEST(5,LEAST(100,COALESCE'));
  assert(read('backend/schema.sql').includes('CHECK (daily_goal BETWEEN 5 AND 100)'));
});
test('operator inventory/verifiers are read-only and never return password/token values', () => {
  for (const file of ['backend/supabase_fresh_preflight.sql','backend/supabase_migration_preflight.sql','backend/verify_security_phase2.sql','backend/verify_migration_readiness.sql']) {
    const items = statements(read(file)); assert.equal(items[0],'BEGIN READ ONLY'); assert.equal(items.at(-1),'ROLLBACK');
    assert(!items.some(s => /^(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|TRUNCATE)\b/i.test(s)));
    // Inspect returned SELECT statements; a DO-local SELECT * FROM (VALUES ...)
    // describes required column names and does not return any application rows.
    for (const stmt of items.filter(s => /^SELECT\b/i.test(s)))
      assert(!/SELECT\s+(?:\*|password_hash|encrypted_password|access_token|refresh_token)\s+FROM/i.test(stmt));
  }
});
test('bootstrap is a rollback-default operator transaction, not a callable granting mechanism', () => {
  const source = read('backend/operator_first_super_admin.sql'); const items = statements(source);
  assert.equal(items[0],'BEGIN'); assert.equal(items.at(-1),'ROLLBACK');
  assert(!/CREATE\s+(?:OR REPLACE\s+)?FUNCTION|GRANT\s+|INSERT INTO auth\.users/i.test(source));
  for (const guard of ["current_user <> 'postgres'",'verified_auth_uuid UUID := NULL',
    'identity.email_confirmed_at IS NULL','profile.is_blocked','profile.email IS DISTINCT FROM identity.email',
    "role='super_admin'",'auth_user_id=verified_auth_uuid','LOCK TABLE public.admins IN SHARE ROW EXCLUSIVE MODE',
    'already has admin authorization','already exists; this first-admin procedure cannot be reused']) assert(source.includes(guard), guard);
  assert(source.includes('WHERE id=legacy_admin_row_id'));
  assert(!/WHERE\s+(?:\w+\.)?(?:username|email)\s*=/i.test(source));
  assert(!/password_hash\s*=|encrypted_password|service_role|raw_user_meta_data/i.test(source));
  assert(source.includes("'BOOTSTRAP_SUPER_ADMIN'"));
});
test('normal signup profile trigger never grants admin privileges', () => {
  const body = statements(sql[0]).find(s => s.startsWith('CREATE OR REPLACE FUNCTION ingly_private.create_auth_profile()'));
  assert(body.includes('INSERT INTO public.users')); assert(!body.includes('public.admins'));
  assert(!body.includes('super_admin')); assert(body.includes('NEW.id, NEW.id'));
});
test('both shipped email forms parse as JSX and explain the credential change', () => {
  for (const file of ['admin/index.html','admin/preview.html']) {
    const html = read(file);
    const email = html.match(/<input\s+type="email"[\s\S]*?value=\{adminLoginInput\}[\s\S]*?\/>/);
    assert(email); assert(email[0].includes('inputMode="email"')); assert(email[0].includes('onInvalid='));
    assert(html.includes('Eski username orqali kirish'));
    for (const script of html.matchAll(/<script\b[^>]*type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g))
      parser.parse(script[1], { sourceType: 'script', plugins: ['jsx'] });
  }
});
test('Auth failures stop before roles; ordinary users are signed out after authorization denial', async () => {
  let authError = new Error('Invalid login credentials'), userId = 'verified-id', access = null;
  let roleCalls = 0, signouts = 0, submitted;
  const client = { auth: {
    signInWithPassword: async p => { submitted = p; return {error:authError}; },
    getUser: async () => ({data:{user:{id:userId}},error:null}),
    signOut: async () => {signouts++;return {error:null};}
  }, rpc: async () => {roleCalls++;return {data:access,error:null};} };
  const store = {removeItem() {}};
  const window = {...browserEnvironment(),supabase:{createClient:() => client}};
  vm.runInNewContext(read('admin/public/auth.js'),{window,localStorage:store,sessionStorage:store});
  await assert.rejects(window.inglyAuth.login('owner@example.invalid','mock-test-input'),/Invalid login credentials/);
  assert.equal(roleCalls,0); assert.equal(submitted.email,'owner@example.invalid'); assert(!('username' in submitted));
  authError = null;
  await assert.rejects(window.inglyAuth.login('owner@example.invalid','mock-test-input'),/Admin authorization denied/);
  assert.equal(signouts,1);
  access = {auth_user_id:'another-id',role:'super_admin'};
  await assert.rejects(window.inglyAuth.login('owner@example.invalid','mock-test-input'),/Admin authorization denied/);
  assert.equal(signouts,2);
  access = {auth_user_id:userId,role:'super_admin'};
  assert.equal((await window.inglyAuth.login('owner@example.invalid','mock-test-input')).role,'super_admin');
});
(async () => {
  let failed=0;
  for (const [name,run] of tests) {try {await run();console.log('PASS: '+name);} catch(error) {failed++;console.error('FAIL: '+name,error);}}
  console.log(`SUPABASE READINESS: ${tests.length-failed} PASS, ${failed} FAIL.`);
  console.log('Lexical/static/mocked checks only. PostgreSQL compilation and actual Auth/RLS require approved staging.');
  process.exitCode=failed ? 1 : 0;
})();
