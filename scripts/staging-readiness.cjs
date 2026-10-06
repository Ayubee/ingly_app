// Local files/configuration only. Verification never connects to Supabase.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { resolveEnvironment } = require('../shared/environment.cjs');
const root = path.resolve(__dirname, '..');
const files = {admin:'admin/.env.staging.local',mobile:'mobile/.env.staging.local'};
const names = {
  admin:['APP_ENV','SUPABASE_URL','SUPABASE_PROJECT_REF','SUPABASE_PUBLISHABLE_KEY','ALLOW_LOCAL_HTTP'],
  mobile:['EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PROJECT_REF',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY','EXPO_PUBLIC_ALLOW_LOCAL_HTTP','EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS']
};
function validate(values, inherited = {}) {
  const configs = {};
  for (const client of ['admin','mobile']) {
    const env = values[client] || {}, keys = names[client];
    for (const key of Object.keys(env)) {
      if (!keys.includes(key)) throw new Error(client + ': unexpected variable ' + key + '; use only the public staging template.');
    }
    for (const key of keys) {
      if (!env[key] || !env[key].trim()) throw new Error(client + ': missing ' + key + '; no fallback.');
      if (inherited[key] !== undefined && inherited[key] !== env[key])
        throw new Error(client + ': shell/file disagreement for ' + key + '; clear the conflicting shell variable.');
    }
    if (env[keys[0]] !== 'staging') throw new Error(client + ': environment must explicitly be staging.');
    if (env[keys[4]] !== 'false')
      throw new Error(client + ': ' + keys[4] + ' must explicitly be false for this staging connection workflow.');
    // Staging may opt into the existing dev-only, local TEST/MOCK simulator.
    // The payment runtime still requires __DEV__; production is rejected below.
    if (client === 'mobile' && !['false','true'].includes(env.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS))
      throw new Error('mobile: EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS must explicitly be true or false.');
    configs[client] = resolveEnvironment({environment:env[keys[0]],url:env[keys[1]],
      expectedProjectRef:env[keys[2]],publicKey:env[keys[3]],
      enableMockPayments:client === 'mobile' && env.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS === 'true'});
  }
  for (const field of ['environment','url','projectRef','publicKey'])
    if (configs.admin[field] !== configs.mobile[field])
      throw new Error('Admin/Mobile disagree on ' + field + '; use the same staging project and public key.');
  return configs;
}
function loadConfiguration(directory = root, inherited = process.env) {
  if (typeof parseEnv !== 'function') throw new Error('Node.js 20.12+ with util.parseEnv is required.');
  const values = {};
  for (const client of ['admin','mobile']) {
    const filename = path.join(directory,files[client]);
    if (!fs.existsSync(filename)) throw new Error('Missing ' + files[client] + '; copy its .example and fill real staging PUBLIC values. No fallback.');
    const source = fs.readFileSync(filename,'utf8');
    const assignments = [...source.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(m=>m[1]);
    if (new Set(assignments).size !== assignments.length) throw new Error(client + ': duplicate env variable; remove ambiguity.');
    values[client] = parseEnv(source);
  }
  return {values,configs:validate(values,inherited)};
}
function run(args) {
  const allowed = ['verify','admin-build','mobile-export','plan'];
  if (!allowed.includes(args[0]) || (args[0] === 'mobile-export'
    ? args.length !== 2 || !['android','ios'].includes(args[1]) : args[0] === 'plan'
      ? args.length !== 2 || !['fresh','existing'].includes(args[1]) : args.length !== 1))
    throw new Error('Use verify | admin-build | mobile-export android|ios | plan fresh|existing. No force, deploy or SQL option.');
  const {values,configs} = loadConfiguration();
  require('../backend/scripts/migration-manifest.cjs').verifyManifest();
  if (args[0] === 'plan') {
    const {preparePlan} = require('../backend/scripts/prepare-staging-plan.cjs');
    console.log(JSON.stringify(preparePlan({environment:'staging',projectRef:configs.admin.projectRef,baseline:args[1]}),null,2));
    return;
  }
  console.log('STAGING CONFIG VERIFIED LOCALLY: ' + configs.admin.projectRef);
  console.log('Admin + Mobile agree; HTTPS; public key only; production rejected; manifest verified.');
  console.log('No remote target/key validity check or migration approval.');
  if (args[0] === 'verify') return;
  // Pin every consumed variable. Expo dotenv is disabled; old mobile/.env is never loaded.
  // Vite gives these validated process variables precedence over all dotenv files.
  const env = {...process.env,...values.admin,...values.mobile,EXPO_NO_DOTENV:'1',EXPO_OFFLINE:'1'};
  const client = args[0] === 'admin-build' ? 'admin' : 'mobile';
  const cwd = path.join(root,client);
  const { spawnSync } = require('node:child_process');
  // Expo inlines EXPO_PUBLIC_* into cached transforms; never reuse another target's cache.
  const commands = client === 'admin' ? [
    ['scripts/build-real-data.cjs'],['node_modules/vite/bin/vite.js','build','--mode','staging']
  ] : [['node_modules/expo/bin/cli','export','--clear','--platform',args[1],'--output-dir','dist/staging-'+args[1]]];
  for (const command of commands) {
    const result = spawnSync(process.execPath,command,{cwd,env,stdio:'inherit'});
    if (result.error || result.status !== 0) throw new Error('Local staging build/export failed; stop and inspect build output.');
  }
}
if (require.main === module) {
  try { run(process.argv.slice(2)); } catch (error) { console.error(error.message);process.exitCode=1; }
}
module.exports = {validate,loadConfiguration,names,files};
