const { resolveEnvironment } = require('../shared/environment.cjs');
// Validate at Expo config/export time as well as at client startup.
module.exports = ({ config }) => {
  const target = resolveEnvironment({ environment:process.env.EXPO_PUBLIC_APP_ENV,
    url:process.env.EXPO_PUBLIC_SUPABASE_URL, publicKey:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    expectedProjectRef:process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
    allowLocalHttp:process.env.EXPO_PUBLIC_ALLOW_LOCAL_HTTP === 'true',
    enableMockPayments:process.env.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS === 'true' });
  const suffix = target.environment === 'production' ? '' : '.' + target.environment;
  return { ...config,
    name:target.environment === 'production' ? 'Ingly' : 'Ingly ('+target.environment.toUpperCase()+')',
    slug:target.environment === 'production' ? 'ingly' : 'ingly-'+target.environment,
    ios:{...config.ios,bundleIdentifier:'com.ingly.app'+suffix},
    android:{...config.android,package:'com.ingly.app'+suffix} };
};
