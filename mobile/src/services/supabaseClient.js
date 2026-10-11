import { createClient, processLock } from '@supabase/supabase-js';
import { authStorage } from './storage.js';
import { APP_CONFIG } from './environment.js';
export const SUPABASE_URL = APP_CONFIG.url;
export const SUPABASE_ANON_KEY = APP_CONFIG.publicKey;
// Abort the request itself so an abandoned request cannot sign in later.
export async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: fetchWithTimeout },
  auth: { storage: authStorage, storageKey: 'ingly_supabase_auth_v2', lock: processLock, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
export function isSupabaseConfigured() { return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY); }
export default supabase;
