// Reproduce the disabled-provider failure through the actual AuthScreen handler
// and installed Supabase SDK. Native controls are headless; HTTP is real.
// Refuses to run when phone is enabled. No reachable phone or real user is used.
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { createClient } = require('../mobile/node_modules/@supabase/supabase-js');
const { configuration } = require('./auth-backend-check.cjs');
const { load, screen } = require('../tests/helpers/auth-harness.cjs');
(async () => {
  const config = configuration(process.argv[2]);
  const settings = await fetch(config.url + '/auth/v1/settings', { headers: { apikey: config.publicKey }, signal: AbortSignal.timeout(15000) });
  if (!settings.ok || (await settings.json()).external?.phone !== false) throw new Error('Probe requires a confirmed disabled phone provider.');
  const requests = [];
  const client = createClient(config.url, config.publicKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
      const body = await response.clone().json();
      requests.push({ path: new URL(url).pathname, method: options.method, status: response.status, code: body.error_code || body.code, userCreated: Boolean(body.user?.id || body.id) });
      return response;
    } } });
  const service = load('mobile/src/services/authService.js', { '@supabase/supabase-js': { createClient }, './supabaseClient.js': { supabase: client } });
  let result;
  const form = screen({ register: async input => {
    try { await service.registerAccount(input); result = { success: true }; }
    catch (error) { result = { success: false, code: error.code, message: service.authErrorMessage(error) }; }
    return result;
  } });
  await form.press("Ro'yxatdan o'tish");
  form.input('Masalan: Ayubbek Qodirov', 'Ingly Auth Diagnostic');
  form.input('+998 90 123 45 67', '000000000');
  form.input('Masalan: ayubeey', 'auth_probe_' + Date.now());
  form.input("Yangi parol o'ylab toping", crypto.randomBytes(24).toString('base64url'));
  await form.press("Ro'yxatdan o'tish va Boshlash 🚀");
  const loginForm = screen({ login: async input => {
    try { await service.loginAccount(input); return { success: true }; }
    catch (error) { return { success: false, code: error.code, error: service.authErrorMessage(error) }; }
  } });
  loginForm.input('masalan: +998901234567', 'ingly-auth-probe@example.invalid');
  loginForm.input('Parolingizni kiriting', crypto.randomBytes(24).toString('base64url'));
  await loginForm.press('Kirish ➔');
  const store = new Map();
  const browserStorage = { getItem: key => store.get(key) ?? null, setItem: (key,value) => store.set(key,value), removeItem: key => store.delete(key) };
  const adminRequests = [];
  const browser = { window: { InglyEnvironment: require('../shared/environment.cjs'),
    inglyDeployment: { environment: config.environment, url: config.url, publicKey: config.publicKey, expectedProjectRef: config.projectRef }, supabase: { createClient } },
    localStorage: browserStorage, sessionStorage: browserStorage, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      const response = await fetch(url, options);
      const body = await response.clone().json();
      adminRequests.push({ path: new URL(url).pathname, status: response.status, code: body.error_code || body.code });
      return response;
    } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../admin/public/auth.js'), 'utf8'), browser);
  let adminResult;
  try { await browser.window.inglyAuth.login('ingly-auth-probe@example.invalid', crypto.randomBytes(24).toString('base64url')); adminResult = { success: true }; }
  catch (error) { adminResult = { success: false, code: error.code, message: browser.window.inglyAuth.errorMessage(error) }; }
  console.log(JSON.stringify({ projectRef: config.projectRef, execution: 'headless actual AuthScreen + installed SDK + real HTTP', requests, result,
    invalidMobileCredentials: loginForm.alerts,
    invalidAdminCredentials: { requests: adminRequests, result: adminResult, roleStageReached: adminRequests.some(request => request.path.includes('/rpc/')) },
    nativeDeviceUI: 'BLOCKED — no connected device/browser runtime', profileLoginLogoutRestart: 'BLOCKED — signup rejected, no account/session created' }, null, 2));
  if (!result || result.success) process.exitCode = 1;
})().catch(() => { console.error('Probe could not run; no credentials printed.'); process.exitCode = 1; });
