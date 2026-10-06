import { createClient } from '@supabase/supabase-js';
import { authStorage } from './storage.js';
import { APP_CONFIG } from './environment.js';
export const SUPABASE_URL = APP_CONFIG.url;
export const SUPABASE_ANON_KEY = APP_CONFIG.publicKey;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: authStorage, storageKey: 'ingly_supabase_auth_v2', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
export function isSupabaseConfigured() { return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY); }
export default supabase;
