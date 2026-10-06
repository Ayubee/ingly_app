import { resolveEnvironment, scopeAsyncStorage } from '../../../shared/environment.cjs';
// Expo requires static dot-notation references to inline these public values.
// APP_ENV is independent of NODE_ENV/__DEV__; an export does not choose production.
export const APP_CONFIG = resolveEnvironment({
  environment: process.env.EXPO_PUBLIC_APP_ENV,
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publicKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  expectedProjectRef: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
  allowLocalHttp: process.env.EXPO_PUBLIC_ALLOW_LOCAL_HTTP === 'true',
  enableMockPayments: process.env.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS === 'true',
});
export function isolateStorage(storage) { return scopeAsyncStorage(storage, APP_CONFIG); }
