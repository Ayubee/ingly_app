// Explicit offline test configuration. These public fixture values are NOT keys
// for a real project; SDK/network calls remain mocked in every regression suite.
const environment = require('../../shared/environment.cjs');
const deployment = { environment:'production',
  url:'https://' + environment.PRODUCTION_PROJECT_REF + '.supabase.co',
  expectedProjectRef:environment.PRODUCTION_PROJECT_REF,
  publicKey:'sb_publishable_offline_fixture_not_a_real_key' };
const config = environment.resolveEnvironment(deployment);
const mobileEnvironment = { APP_CONFIG:config, isolateStorage:storage => environment.scopeAsyncStorage(storage,config) };
const browserEnvironment = () => ({ InglyEnvironment:environment, inglyDeployment:deployment });
module.exports = { mobileEnvironment, browserEnvironment };
