import { supabase } from './supabaseClient.js';
import { captureStorageSession, isStorageSessionCurrent } from './storage.js';
export const PROFILE_COLUMNS = 'id,auth_user_id,full_name,username,phone,email,avatar_url,daily_goal,is_blocked,is_premium,premium_until,created_at,updated_at';
export async function fetchUserRemoteStatus(token = captureStorageSession()) {
  const { data: session } = await supabase.auth.getSession();
  const account = session.session;
  const id = account?.user?.id;
  if (!isStorageSessionCurrent(token) || id !== token.owner) throw new Error('Account identity changed.');
  if (!id) return null;
  const { data, error } = await supabase.from('users').select(PROFILE_COLUMNS).eq('auth_user_id', id)
    .maybeSingle().setHeader('Authorization', 'Bearer ' + account.access_token);
  if (error) throw error;
  if (!isStorageSessionCurrent(token)) throw new Error('Account identity changed.');
  return data;
}
export async function syncUserWithSupabase(userData) {
  const token = captureStorageSession();
  const { data: identity, error: identityError } = await supabase.auth.getSession();
  const account = identity.session;
  if (identityError || !account || userData.id !== account.user.id || !isStorageSessionCurrent(token) || token.owner !== account.user.id) throw new Error('Account identity changed.');
  const { data, error } = await supabase.from('users').update({
    full_name: userData.name, avatar_url: userData.avatar || null, daily_goal: Number(userData.dailyGoal) || 20,
  }).eq('auth_user_id', account.user.id).select(PROFILE_COLUMNS).single()
    .setHeader('Authorization', 'Bearer ' + account.access_token);
  if (error) throw error;
  if (!isStorageSessionCurrent(token)) throw new Error('Account identity changed.');
  return data;
}
