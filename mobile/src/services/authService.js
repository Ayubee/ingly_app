import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient.js';
// Never display raw backend messages (they may contain SQL values or contacts).
export function authErrorMessage(error) {
  const code = error?.code;
  if (code === 'invalid_credentials') return 'Telefon/email yoki parol noto‘g‘ri.';
  if (code === 'email_not_confirmed') return 'Email tasdiqlanmagan. Xatingizdagi havolani oching va qayta kiring.';
  if (code === 'phone_not_confirmed') return 'Telefon tasdiqlanmagan. SMS kodni kiriting.';
  if (code === 'phone_provider_disabled' || code === 'signup_disabled') return 'Serverda telefon orqali ro‘yxatdan o‘tish yoqilmagan. Administratorga murojaat qiling.';
  if (code === 'over_request_rate_limit' || code === 'over_sms_send_rate_limit' || error?.status === 429) return 'Urinishlar ko‘payib ketdi. Biroz kutib qayta urinib ko‘ring.';
  if (code === 'weak_password') return 'Parol serverning xavfsizlik talablariga mos emas. Kuchliroq parol kiriting.';
  if (code === 'user_already_exists' || code === 'phone_exists') return 'Bu akkaunt mavjud. Kirish formasidan foydalaning.';
  if (code === 'otp_expired') return 'Tasdiqlash kodi noto‘g‘ri yoki eskirgan. Yangi kod so‘rang.';
  if (code === 'unexpected_failure' || code === '42703' || code === 'PGRST202' || code === '42501') return 'Backend profil sxemasi yoki ruxsatlari sozlanmagan. Administratorga murojaat qiling.';
  if (error?.name === 'AuthRetryableFetchError' || error?.name === 'AbortError' || error?.name === 'TimeoutError' || /fetch|network|timeout/i.test(error?.message || '')) return 'Serverga ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';
  // Validation errors originate here; only these fixed messages are safe to show.
  if (error?.name === 'InputError') return error.message;
  return 'Amal bajarilmadi. Ma’lumotlarni tekshirib, qayta urinib ko‘ring.';
}
function inputError(message) { const error = new Error(message); error.name = 'InputError'; return error; }
export function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!/^\+?[\d\s()-]+$/.test(raw)) throw inputError('Telefon raqami noto\'g\'ri. Login o‘rniga telefon yoki email kiriting.');
  const digits = raw.replace(/\D/g, '');
  if (/^\d{9}$/.test(digits)) return '+998' + digits;
  if (/^998\d{9}$/.test(digits)) return '+' + digits;
  throw inputError('9 ta raqam yoki +998 va 9 ta raqam kiriting.');
}
export async function registerAccount({ fullName, phone, username, password, dailyGoal = 20, avatar = '' }) {
  const login = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,100}$/.test(login)) throw inputError('Login: 3–100 ta lotin harfi, raqam yoki _.');
  if (typeof password !== 'string' || password.length < 6 || !password.trim()) throw inputError('Parol kamida 6 ta belgi va bo‘sh bo‘lmasligi kerak.');
  const name = String(fullName || '').trim();
  if (!name || name.length > 255) throw inputError('Ism va familiya 1–255 ta belgidan iborat bo‘lsin.');
  const normalized = normalizePhone(phone);
  const { data, error } = await supabase.auth.signUp({ phone: normalized, password,
    options: { data: { username: login, full_name: name,
      daily_goal: Number(dailyGoal), avatar: String(avatar).slice(0, 40) } } });
  if (error) throw error;
  return { ...data, phone: normalized };
}
export async function loginAccount({ loginOrPhone, password }) {
  const raw = String(loginOrPhone || '').trim();
  if (raw.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw inputError('Email manzilini to‘g‘ri kiriting.');
  const credentials = raw.includes('@') ? { email: raw.toLowerCase() } : { phone: normalizePhone(raw) };
  if (typeof password !== 'string' || !password.trim()) throw inputError('Parolni kiriting.');
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
  if (!/^\d{6,10}$/.test(String(token).trim())) throw inputError('SMS kodni to‘liq kiriting.');
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
export async function resendRegistration(phone) {
  const { error } = await supabase.auth.resend({ type: 'sms', phone: normalizePhone(phone) });
  if (error) throw error;
}
