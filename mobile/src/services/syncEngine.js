/**
 * Ingly Mobile App - Offline-First Sync Engine
 * 
 * Qurilma oflayn holatda ishlaganda yig'ilgan so'z statuslari va natijalarini
 * tarmoq (internet) paydo bo'lganda Supabase'dagi `sync_user_offline_progress`
 * RPC funksiyasiga batch holatda yuborish mexanizmi.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getSyncQueue, clearSyncQueue, updateUserStreak } from './storage';

// Sinxronizatsiya holati
let isSyncing = false;
let lastSyncTimestamp = null;
let lastSyncError = null;
let autoSyncIntervalId = null;

// UI komponentlari uchun tinglovchilar (Event Listeners)
const syncListeners = new Set();

/**
 * Holat o'zgarganda barcha tinglovchilarga xabar berish
 */
function notifyListeners(event) {
  syncListeners.forEach((callback) => {
    try {
      callback(event);
    } catch (e) {
      console.warn('Sync listener xatosi:', e);
    }
  });
}

/**
 * Sinxronizatsiya holatiga obuna bo'lish (UI uchun)
 * @param {Function} callback (event) => void
 * @returns {Function} Obunani bekor qilish funksiyasi
 */
export function onSyncStateChange(callback) {
  syncListeners.add(callback);
  return () => {
    syncListeners.delete(callback);
  };
}

/**
 * Hozirgi sinxronizatsiya holatini olish
 */
export async function getSyncStatus() {
  const queue = await getSyncQueue();
  return {
    is_syncing: isSyncing,
    pending_count: queue.length,
    last_sync_at: lastSyncTimestamp,
    last_error: lastSyncError,
  };
}

/**
 * Asosiy sinxronizatsiya funksiyasi (Batch UPSERT)
 * @param {string} userId Foydalanuvchi UUID raqami
 */
export async function syncOfflineProgress(userId) {
  // Agar sinxronizatsiya allaqachon ketayotgan bo'lsa, qayta chaqirmaymiz (Mutex)
  if (isSyncing) {
    return { success: false, reason: 'sync_already_in_progress' };
  }

  // 1. Oflayn navbatni tekshirish
  const queue = await getSyncQueue();
  if (!queue || queue.length === 0) {
    return { success: true, synced_count: 0, message: 'Navbat boʻsh' };
  }

  // 2. Agar foydalanuvchi ID si bo'lmasa, auth sessiyadan tekshirib ko'ramiz
  let targetUserId = userId;
  if (!targetUserId) {
    try {
      const { data } = await supabase.auth.getUser();
      targetUserId = data?.user?.id;
    } catch {
      // Offline yoki anonim foydalanuvchi
    }
  }

  if (!targetUserId) {
    // Tizimga kirmagan foydalanuvchi: navbat xavfsiz saqlanadi, tizimga kirgach sinxronlanadi
    return { success: false, reason: 'unauthenticated' };
  }

  isSyncing = true;
  lastSyncError = null;
  notifyListeners({ type: 'sync_started', pending_count: queue.length });

  try {
    // 3. Supabase RPC chaqiruvi uchun ma'lumotlar paketini tayyorlash
    const syncPayload = queue.map((item) => ({
      word_id: Number(item.word_id),
      status: item.status || 'review',
      reviewed_at: item.reviewed_at || new Date().toISOString(),
      is_favorite: !!item.is_favorite,
      next_review_date: item.next_review_date || null,
    }));

    const wordIdsToClear = syncPayload.map((p) => p.word_id);

    // 4. Supabase RPC `sync_user_offline_progress` funksiyasini chaqirish
    const { data, error } = await supabase.rpc('sync_user_offline_progress', {
      p_user_id: targetUserId,
      p_sync_items: syncPayload,
    });

    if (error) {
      throw error;
    }

    // 5. Muvaffaqiyatli: lokal navbatdan sinxronlanganlarni o'chirish
    await clearSyncQueue(wordIdsToClear);

    // 6. Serverdan kelgan yangi streak ma'lumotlarini lokal xotiraga yozish
    if (data && data.current_streak !== undefined) {
      await updateUserStreak({
        current_streak: data.current_streak,
        max_streak: data.max_streak,
      });
    }

    lastSyncTimestamp = new Date().toISOString();
    isSyncing = false;

    const result = {
      success: true,
      synced_count: data?.synced_count || syncPayload.length,
      current_streak: data?.current_streak,
      max_streak: data?.max_streak,
      synced_at: lastSyncTimestamp,
    };

    notifyListeners({ type: 'sync_completed', result });
    return result;
  } catch (err) {
    console.warn('[SyncEngine] Sinxronizatsiya xatosi (navbat saqlab qolindi):', err?.message);
    isSyncing = false;
    lastSyncError = err?.message || 'Tarmoq xatosi';

    notifyListeners({ type: 'sync_failed', error: lastSyncError });

    return {
      success: false,
      error: lastSyncError,
      message: 'Internet aloqasi tiklanganda qayta uriniladi',
    };
  }
}

/**
 * Avtomatik orqa fonda sinxronizatsiya qilishni yoqish
 * @param {string} userId Foydalanuvchi ID
 * @param {number} intervalMs Sinxronlash davriyligi (standart: 25 soniya)
 */
export function startAutoSync(userId, intervalMs = 25000) {
  stopAutoSync();

  // Dastlabki bir martalik tekshiruv
  syncOfflineProgress(userId).catch(() => {});

  // Muntazam davriy tekshiruv
  autoSyncIntervalId = setInterval(() => {
    syncOfflineProgress(userId).catch(() => {});
  }, intervalMs);
}

/**
 * Avtomatik sinxronizatsiyani to'xtatish
 */
export function stopAutoSync() {
  if (autoSyncIntervalId) {
    clearInterval(autoSyncIntervalId);
    autoSyncIntervalId = null;
  }
}
