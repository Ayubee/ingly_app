import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient.js';
export function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!/^[+\d\s()-]+$/.test(raw)) throw new Error('Telefon raqami noto\'g\'ri.');
  const digits = raw.replace(/\D/g, '');
  if (/^\d{9}$/.test(digits)) return '+998' + digits;
  if (/^998\d{9}$/.test(digits)) return '+' + digits;
  throw new Error('9 ta raqam yoki +998 va 9 ta raqam kiriting.');
}
export async function registerAccount({ fullName, phone, username, password, dailyGoal = 20, avatar = '' }) {
  const login = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,100}$/.test(login)) throw new Error('Login: kamida 3 ta lotin harfi, raqam yoki _.');
  if (typeof password !== 'string' || password.length < 6) throw new Error('Parol kamida 6 ta belgi.');
  const normalized = normalizePhone(phone);
  const { data, error } = await supabase.auth.signUp({ phone: normalized, password,
    options: { data: { username: login, full_name: String(fullName || '').trim() || login,
      daily_goal: Number(dailyGoal), avatar: String(avatar).slice(0, 40) } } });
  if (error) throw error;
  return { ...data, phone: normalized };
}
export async function loginAccount({ loginOrPhone, password }) {
  const raw = String(loginOrPhone || '').trim();
  const credentials = raw.includes('@') ? { email: raw } : { phone: normalizePhone(raw) };
  const { data, error } = await supabase.auth.signInWithPassword({ ...credentials, password });
  if (error?.code === 'phone_not_confirmed' && credentials.phone) {
    const { error: resendError } = await supabase.auth.resend({ type: 'sms', phone: credentials.phone });
    if (resendError) throw resendError;
    return { needsVerification: true, phone: credentials.phone };
  }
  if (error) throw error;
  if (!data.session) throw new Error('Tasdiqlangan sessiya mavjud emas.');
  return data;
}
export async function verifyRegistration(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone), token: String(token).trim(), type: 'sms' });
  if (error) throw error;
  if (!data.session) throw new Error('Tasdiqlash bajarilmadi.');
  return data;
}
export async function changeAccountPassword(oldPassword, newPassword) {
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user) throw new Error('Qayta kiring.');
  if (typeof newPassword !== 'string' || newPassword.length < 6) throw new Error('Parol kamida 6 ta belgi.');
  const contact = identity.user.email ? { email: identity.user.email } : { phone: identity.user.phone };
  // Keep reauthentication separate from the main session, including account-switch races.
  const passwordClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: checked, error: checkError } = await passwordClient.auth.signInWithPassword({ ...contact, password: oldPassword });
  if (checkError || checked.user?.id !== identity.user.id) throw new Error('Joriy parol tasdiqlanmadi.');
  const { data: current } = await supabase.auth.getSession();
  if (current.session?.user?.id !== identity.user.id) throw new Error('Account changed.');
  const { data: updated, error } = await passwordClient.auth.updateUser({ password: newPassword });
  if (error) throw error;
  if (updated.user?.id !== identity.user.id) throw new Error('Account changed.');
}
