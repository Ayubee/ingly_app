// Public, read-only preflight. Never reads user rows or prints keys/tokens.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { resolveEnvironment } = require('../shared/environment.cjs');
const root = path.resolve(__dirname, '..');
function configuration(environment) {
  if (!['production', 'staging'].includes(environment)) throw new Error('Choose production or staging explicitly.');
  const files = { admin: `admin/.env.${environment}.local`, mobile: environment === 'production' ? 'mobile/.env' : 'mobile/.env.staging.local' };
  const configs = {};
  for (const [client, file] of Object.entries(files)) {
    const env = parseEnv(fs.readFileSync(path.join(root, file), 'utf8'));
    const prefix = client === 'mobile' ? 'EXPO_PUBLIC_' : '';
    configs[client] = resolveEnvironment({ environment: env[prefix + 'APP_ENV'], url: env[prefix + 'SUPABASE_URL'],
      publicKey: env[client === 'mobile' ? 'EXPO_PUBLIC_SUPABASE_ANON_KEY' : 'SUPABASE_PUBLISHABLE_KEY'],
      expectedProjectRef: env[prefix + 'SUPABASE_PROJECT_REF'] });
    if (configs[client].environment !== environment) throw new Error(client + ' environment mismatch.');
  }
  if (['url','projectRef','publicKey'].some(key => configs.admin[key] !== configs.mobile[key])) throw new Error('Admin and mobile must use the same project and public key.');
  return configs.admin;
}
async function inspect(config, request = fetch) {
  const checks = [];
  for (const [name, route, method] of [
    ['auth_settings', '/auth/v1/settings', 'GET'],
    ['profile_schema', '/rest/v1/users?select=id,auth_user_id&limit=0', 'GET'],
    ['admin_schema', '/rest/v1/admins?select=id,auth_user_id,role,is_active&limit=0', 'GET'],
    ['admin_rpc', '/rest/v1/rpc/get_my_admin_access', 'POST'],
  ]) {
    try {
      const response = await request(config.url + route, { method, headers: { apikey: config.publicKey, 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (name === 'auth_settings') {
        checks.push({ name, status: response.status, result: response.ok ? 'PASS' : 'FAIL',
          email: data.external?.email, phone: data.external?.phone, signup: data.disable_signup === false,
          emailConfirmation: data.mailer_autoconfirm === false, phoneConfirmation: data.phone_autoconfirm === false });
        checks.push({ name: 'mobile_phone_signup', result: response.ok && data.external?.phone && !data.disable_signup ? 'PASS' : 'FAIL' });
      } else {
        // 42501 / 401 means the object is protected, not missing. It is NOT an
        // authenticated RLS test; actual ownership/admin checks remain blocked.
        const protectedObject = data.code === '42501';
        checks.push({ name, status: response.status, code: data.code, result: response.ok || protectedObject ? 'PASS' : 'FAIL' });
      }
    } catch (error) {
      checks.push({ name, result: 'FAIL', networkCode: error.cause?.code || error.name });
    }
  }
  return { environment: config.environment, projectRef: config.projectRef, checks,
    authenticatedFlows: 'BLOCKED — requires dedicated verified user/admin accounts',
    ready: checks.every(check => check.result === 'PASS') };
}
if (require.main === module) (async () => {
  const report = await inspect(configuration(process.argv[2]));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) process.exitCode = 1;
})().catch(() => { console.error('Configuration failed. Check explicit public environment files; no fallback is used.'); process.exitCode = 1; });
module.exports = { configuration, inspect };
