import { authStorage } from './storage.js';
// Read only the SDK's persisted session, never a profile or legacy login record.
// This enables local UI; every server request still requires a Supabase-validated JWT.
export async function readCachedAuthSession() {
  try {
    const raw = await authStorage.getItem('ingly_supabase_auth_v2');
    const session = raw ? JSON.parse(raw) : null;
    if (!session?.user?.id || typeof session.access_token !== 'string' || !session.access_token || typeof session.refresh_token !== 'string' || !session.refresh_token || !Number.isFinite(session.expires_at) || session.expires_at * 1000 <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
