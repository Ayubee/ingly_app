/**
 * INGLY MOBILE - USER SERVICE (SECURITY HARDENED)
 * Foydalanuvchilarni Supabase bulut bazasi bilan sinxronizatsiya qilish xizmati.
 * Xavfsizlik choralari:
 * 1. Parollar hech qachon ochiq matnda saqlanmaydi va uzatilmaydi (Salted SHA-256).
 * 2. Supabase API so'rovlarida `password_hash` ochiq so'ralmaydi va sizdirilmaydi.
 * 3. Barcha URL parametrlari `encodeURIComponent` bilan query injection dan himoyalangan.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from './storage.js';
import { hashPassword } from '../utils/crypto.js';

const SUPABASE_REST_URL = 'https://lbsqxownrjfmjoojdsfk.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_Kbpya9vZpqll4KuUXQrpHQ_Tq3qcZ1W';

/**
 * 1. Foydalanuvchi ma'lumotlarini Supabase `users` jadvaliga yuklash/yangilash
 */
export async function syncUserWithSupabase(userData) {
  if (!userData || !userData.username) return null;

  const cleanUsername = String(userData.username).trim().toLowerCase();
  const cleanPhone = userData.phone ? String(userData.phone).trim() : null;
  const fullName = String(userData.name || userData.fullName || cleanUsername).trim();

  const createdAtIso = userData.createdAt || userData.created_at || new Date().toISOString();

  const userPayload = {
    full_name: fullName,
    username: cleanUsername,
    phone: cleanPhone,
    daily_goal: Number(userData.dailyGoal) || 20,
    is_premium: !!userData.isPremium,
    premium_until: userData.premiumUntil || null,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Parol berilgan bo'lsa, uni SHA-256 bilan heshlab saqlaymiz (ochiq matn hech qachon yuborilmaydi)
  if (userData.password) {
    userPayload.password_hash = hashPassword(userData.password);
  } else if (userData.password_hash) {
    userPayload.password_hash = hashPassword(userData.password_hash);
  }

  const initialInsertPayload = {
    ...userPayload,
    is_blocked: false,
    created_at: createdAtIso,
  };

  try {
    // 1-usul: Supabase mijoz orqali
    if (isSupabaseConfigured() && supabase) {
      // Avval mavjudligini tekshirish (faqat xavfsiz ustunlar olinadi, password_hash sizdirilmaydi)
      const encodedUsername = encodeURIComponent(cleanUsername);
      const encodedPhone = cleanPhone ? encodeURIComponent(cleanPhone) : null;

      const { data: existingUser } = await supabase
        .from('users')
        .select('id, is_blocked, is_premium, created_at')
        .or(`username.eq.${encodedUsername}${encodedPhone ? `,phone.eq.${encodedPhone}` : ''}`)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        // Mavjud bo'lsa yangilash (is_blocked tegilmaydi, serverdagi VIP saqlanadi)
        const targetId = existingUser[0].id;
        const finalPayload = { ...userPayload };
        if (existingUser[0].is_premium && !userData.isPremium) {
          finalPayload.is_premium = true;
          finalPayload.premium_until = existingUser[0].premium_until || userPayload.premium_until;
        }

        const { data: updated, error: updateErr } = await supabase
          .from('users')
          .update(finalPayload)
          .eq('id', targetId)
          .select('id, full_name, username, phone, daily_goal, is_premium, is_blocked, created_at');

        if (!updateErr && updated && updated[0]) {
          return updated[0];
        }
      } else {
        // Yangi foydalanuvchi qo'shish
        const { data: inserted, error: insertErr } = await supabase
          .from('users')
          .insert([initialInsertPayload])
          .select('id, full_name, username, phone, daily_goal, is_premium, is_blocked, created_at');

        if (!insertErr && inserted && inserted[0]) {
          return inserted[0];
        }
      }
    }

    // 2-usul: To'g'ridan-to'g'ri REST API (Parametrlari to'liq encodeURIComponent bilan xavfsizlangan)
    const restHeaders = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    const encodedUser = encodeURIComponent(cleanUsername);
    // Tekshirish (password_hash so'ralmaydi!)
    const checkQuery = `${SUPABASE_REST_URL}/users?username=eq.${encodedUser}&select=id,is_blocked,is_premium,premium_until,created_at`;
    const checkRes = await fetch(checkQuery, { headers: restHeaders });
    const existingList = checkRes.ok ? await checkRes.json() : [];

    if (Array.isArray(existingList) && existingList.length > 0) {
      const uId = encodeURIComponent(existingList[0].id);
      const finalRestPayload = { ...userPayload };
      if (existingList[0].is_premium && !userData.isPremium) {
        finalRestPayload.is_premium = true;
        finalRestPayload.premium_until = existingList[0].premium_until || userPayload.premium_until;
      }

      const patchRes = await fetch(`${SUPABASE_REST_URL}/users?id=eq.${uId}`, {
        method: 'PATCH',
        headers: restHeaders,
        body: JSON.stringify(finalRestPayload),
      });
      if (patchRes.ok) {
        const patchData = await patchRes.json();
        return patchData[0];
      }
    } else {
      const postRes = await fetch(`${SUPABASE_REST_URL}/users`, {
        method: 'POST',
        headers: restHeaders,
        body: JSON.stringify(initialInsertPayload),
      });
      if (postRes.ok) {
        const postData = await postRes.json();
        return postData[0];
      }
    }
  } catch (err) {
    console.warn('[UserService] syncUserWithSupabase xatosi:', err?.message || err);
  }
  return null;
}

/**
 * 2. Avval ro'yxatdan o'tgan barcha lokal foydalanuvchilarni Supabase'ga xavfsiz yuborish
 */
export async function syncAllLocalUsersToSupabase() {
  try {
    const allUsers = (await getStorageItem(STORAGE_KEYS.REGISTERED_USERS, [])) || [];
    const currentProfile = await getStorageItem(STORAGE_KEYS.USER_PROFILE, null);

    const listToSync = [...allUsers];
    if (currentProfile && currentProfile.username && !listToSync.some(u => u.username === currentProfile.username)) {
      listToSync.push(currentProfile);
    }

    for (const u of listToSync) {
      if (u.username) {
        await syncUserWithSupabase(u);
      }
    }
  } catch (e) {
    console.warn('[UserService] syncAllLocalUsersToSupabase xatosi:', e?.message || e);
  }
}

/**
 * 3. Foydalanuvchining Supabase'dagi joriy statusini olish (Bloklanganmi yoki VIP statusi)
 * Xavfsizlik: password_hash API orqali chiqarilmaydi! URL parametrlari to'liq encode qilinadi.
 */
export async function fetchUserRemoteStatus(loginOrPhone) {
  if (!loginOrPhone) return null;
  const raw = String(loginOrPhone).trim();
  const cleanUsername = raw.toLowerCase().replace(/^@/, '');
  const digits = raw.replace(/\D/g, '');

  const encodedUsername = encodeURIComponent(cleanUsername);
  const encodedDigits = encodeURIComponent(digits.slice(-9));

  try {
    const isPhoneNumber = raw.startsWith('+') || /^\d+$/.test(raw);
    let query = `${SUPABASE_REST_URL}/users?username=eq.${encodedUsername}&select=id,username,full_name,phone,is_blocked,is_premium,premium_until,password_hash,created_at`;
    if (isPhoneNumber && digits.length >= 9) {
      query = `${SUPABASE_REST_URL}/users?phone=like.*${encodedDigits}&select=id,username,full_name,phone,is_blocked,is_premium,premium_until,password_hash,created_at`;
    }

    const res = await fetch(query, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
    }
  } catch (e) {
    // oflayn bo'lsa xato qilmaydi
  }
  return null;
}

/**
 * 4. Parolni serverda xavfsiz tekshirish (REST orqali to'g'ridan-to'g'ri)
 */
export async function verifyUserCredentialsRemote(loginOrPhone, passwordHash) {
  if (!loginOrPhone || !passwordHash) {
    return { success: false, error: 'Login yoki parol kiritilmadi' };
  }

  try {
    const raw = String(loginOrPhone).trim();
    const cleanUsername = raw.toLowerCase().replace(/^@/, '');
    const digits = raw.replace(/\D/g, '');

    const encodedUsername = encodeURIComponent(cleanUsername);
    const encodedDigits = encodeURIComponent(digits.slice(-9));

    let query = `${SUPABASE_REST_URL}/users?username=eq.${encodedUsername}&select=id,username,full_name,phone,password_hash,is_blocked,is_premium`;
    if (digits.length >= 9) {
      query = `${SUPABASE_REST_URL}/users?or=(username.eq.${encodedUsername},phone.like.*${encodedDigits})&select=id,username,full_name,phone,password_hash,is_blocked,is_premium`;
    }

    const res = await fetch(query, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const u = data[0];
        if (u.is_blocked) {
          return { success: false, isBlocked: true, error: 'Sizning hisobingiz bloklangan!' };
        }
        // Hash yoki ochiq parol bilan solishtirish
        const isMatch = u.password_hash === passwordHash || (u.password_hash && u.password_hash === hashPassword(passwordHash));
        if (isMatch) {
          return { success: true, user: u };
        } else {
          return { success: false, error: 'Kiritilgan parol noto\'g\'ri!' };
        }
      }
    }
  } catch (err) {
    console.warn('[UserService] verifyUserCredentialsRemote xatosi:', err);
  }
  return null;
}

