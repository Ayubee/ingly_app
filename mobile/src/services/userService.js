/**
 * INGLY MOBILE - USER SERVICE
 * Foydalanuvchilarni Supabase bulut bazasi bilan sinxronizatsiya qilish xizmati.
 * Har qanday ro'yxatdan o'tgan foydalanuvchi darhol Supabase `users` jadvaliga
 * va Admin panelga real-time ko'rinadi.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from './storage.js';

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

  const userPayload = {
    full_name: fullName,
    username: cleanUsername,
    phone: cleanPhone,
    daily_goal: Number(userData.dailyGoal) || 20,
    is_blocked: !!userData.isBlocked,
    is_premium: !!userData.isPremium,
    last_login_at: new Date().toISOString(),
  };

  try {
    // 1-usul: Supabase mijoz orqali
    if (isSupabaseConfigured() && supabase) {
      // Avval mavjudligini tekshirish
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, is_blocked, is_premium')
        .or(`username.eq.${cleanUsername}${cleanPhone ? `,phone.eq.${cleanPhone}` : ''}`)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        // Mavjud bo'lsa yangilash
        const targetId = existingUser[0].id;
        const { data: updated, error: updateErr } = await supabase
          .from('users')
          .update(userPayload)
          .eq('id', targetId)
          .select();

        if (!updateErr && updated && updated[0]) {
          return updated[0];
        }
      } else {
        // Yangi foydalanuvchi qo'shish
        const { data: inserted, error: insertErr } = await supabase
          .from('users')
          .insert([userPayload])
          .select();

        if (!insertErr && inserted && inserted[0]) {
          return inserted[0];
        }
      }
    }

    // 2-usul: To'g'ridan-to'g'ri REST API (Kutubxona yuklanmasa ham 100% ishlaydi)
    const restHeaders = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    // Tekshirish
    const checkQuery = `${SUPABASE_REST_URL}/users?username=eq.${cleanUsername}&select=id,is_blocked,is_premium`;
    const checkRes = await fetch(checkQuery, { headers: restHeaders });
    const existingList = checkRes.ok ? await checkRes.json() : [];

    if (Array.isArray(existingList) && existingList.length > 0) {
      const uId = existingList[0].id;
      const patchRes = await fetch(`${SUPABASE_REST_URL}/users?id=eq.${uId}`, {
        method: 'PATCH',
        headers: restHeaders,
        body: JSON.stringify(userPayload),
      });
      if (patchRes.ok) {
        const patchData = await patchRes.json();
        return patchData[0];
      }
    } else {
      const postRes = await fetch(`${SUPABASE_REST_URL}/users`, {
        method: 'POST',
        headers: restHeaders,
        body: JSON.stringify(userPayload),
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
 * 2. Avval ro'yxatdan o'tgan barcha lokal foydalanuvchilarni Supabase'ga yuborish
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
 * 3. Foydalanuvchining Supabase'dagi joriy statusini olish (Bloklanganmi yoki VIP?)
 */
export async function fetchUserRemoteStatus(username) {
  if (!username) return null;
  const cleanUsername = String(username).trim().toLowerCase();

  try {
    const res = await fetch(`${SUPABASE_REST_URL}/users?username=eq.${cleanUsername}&select=id,is_blocked,is_premium`, {
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
