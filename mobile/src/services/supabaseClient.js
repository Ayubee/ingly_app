import { createClient } from '@supabase/supabase-js';
import { authStorage } from './storage.js';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lbsqxownrjfmjoojdsfk.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Kbpya9vZpqll4KuUXQrpHQ_Tq3qcZ1W';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: authStorage, storageKey: 'ingly_supabase_auth_v2', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
export function isSupabaseConfigured() { return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY); }
export default supabase;
