/**
 * Ingly Mobile App - App Settings & Live Feature Flags Service
 * 
 * Supabase bulut bazasidagi `app_settings` jadvali bilan real-time bog'lanadi.
 * Admin paneldan reklama yoki VIP rejim yoqilganda/o'chirilganda,
 * mobil ilovada darhol aks etadi.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getStorageItem, setStorageItem, getStorageAccountId, captureStorageSession } from './storage';

const STORAGE_KEY_SETTINGS = 'ingly_cached_app_settings';

// Boshlang'ich standart parametrlar (TZ.txt bo'yicha)
let currentSettings = {
  ads_enabled: false,
  premium_mode_enabled: true,
  free_books_count: 1, // Faqat Book 1 bepul, Book 2-6 lar VIP / pullik
  free_book_ids: [1], // Qaysi kitoblar bepul ekanligi ro'yxati (masalan: [1], [1, 3])
  videos_enabled: true, // Barcha kinolar va videolarni ilovada ko'rsatish/yashirish
  latest_announcement: null, // Admin paneldan yuborilgan yangi e'lon/yangilik
  daily_goal_default: 20,
  premium_monthly_original_price: 59000, // VIP oylik obuna asl (haqiqiy) narxi (so'm)
  premium_monthly_price: 29000,          // VIP oylik obuna chegirmadagi amaldagi narxi (so'm)
  single_book_original_price: 35000,     // Bitta kitob asl (haqiqiy) narxi (so'm)
  single_book_price: 19000,              // Bitta kitob chegirmadagi amaldagi narxi (so'm)
};
const publicSettingKeys = new Set(Object.keys(currentSettings));

const listeners = new Set();
let isRealtimeSubscribed = false;

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn(currentSettings);
    } catch (e) {
      console.warn('[AppSettings] Listener error:', e);
    }
  });
}

/**
 * Sozlamalar o'zgarganda xabardor bo'lish (UI uchun)
 */
export function onSettingsChange(callback) {
  listeners.add(callback);
  // Hozirgi holatni darhol yetkazish
  callback(currentSettings);
  return () => listeners.delete(callback);
}

/**
 * Hozirgi sozlamalarni olish
 */
export function getAppSettings() {
  return currentSettings;
}

/**
 * Sozlamalarni Supabase'dan yuklash va Real-time obunani faollashtirish
 */
export async function initAppSettings() {
  // 1. Keshdan o'qish (Tezkor yuklanish uchun)
  try {
    const cached = await getStorageItem(STORAGE_KEY_SETTINGS, null);
    if (cached) {
      const safeSettings = Object.fromEntries(Object.entries(cached).filter(([key]) => publicSettingKeys.has(key)));
      currentSettings = { ...currentSettings, ...safeSettings };
      await setStorageItem(STORAGE_KEY_SETTINGS, currentSettings);
      notifyListeners();
    }
  } catch (e) {
    console.warn('[AppSettings] Cache read error:', e);
  }

  // 2. Agar Supabase ulangan bo'lsa, serverdan eng so'nggi holatni tortib olish
  if (!isSupabaseConfigured()) {
    return currentSettings;
  }

  try {
    const { data, error } = await supabase.from('app_settings').select('*');
    if (!error && Array.isArray(data)) {
      data.forEach((item) => {
        if (item.setting_key === 'ads_enabled') {
          currentSettings.ads_enabled = item.setting_value === true || item.setting_value === 'true';
        } else if (item.setting_key === 'premium_mode_enabled') {
          currentSettings.premium_mode_enabled = item.setting_value === true || item.setting_value === 'true';
        } else if (item.setting_key === 'free_books_count') {
          currentSettings.free_books_count = item.setting_value !== undefined ? Number(item.setting_value) : 1;
        } else if (item.setting_key === 'free_book_ids') {
          try {
            const val = Array.isArray(item.setting_value)
              ? item.setting_value
              : typeof item.setting_value === 'string'
                ? JSON.parse(item.setting_value)
                : [1];
            currentSettings.free_book_ids = Array.isArray(val) ? val.map(Number) : [1];
          } catch (e) {
            currentSettings.free_book_ids = [1];
          }
        } else if (item.setting_key === 'daily_goal_default') {
          currentSettings.daily_goal_default = Number(item.setting_value) || 20;
        } else if (item.setting_key === 'premium_monthly_original_price') {
          currentSettings.premium_monthly_original_price = Number(item.setting_value) || 59000;
        } else if (item.setting_key === 'premium_monthly_price') {
          currentSettings.premium_monthly_price = Number(item.setting_value) || 29000;
        } else if (item.setting_key === 'single_book_original_price') {
          currentSettings.single_book_original_price = Number(item.setting_value) || 35000;
        } else if (item.setting_key === 'single_book_price') {
          currentSettings.single_book_price = Number(item.setting_value) || 19000;
        } else if (item.setting_key === 'videos_enabled') {
          currentSettings.videos_enabled = item.setting_value === true || item.setting_value === 'true';
        } else if (item.setting_key === 'latest_announcement') {
          currentSettings.latest_announcement = item.setting_value && typeof item.setting_value === 'object'
            ? item.setting_value
            : typeof item.setting_value === 'string' && item.setting_value.startsWith('{')
              ? JSON.parse(item.setting_value)
              : item.setting_value || null;
        }
      });

      await setStorageItem(STORAGE_KEY_SETTINGS, currentSettings);
      notifyListeners();
    }

    // 3. Supabase Realtime obunasi (Admin o'zgartirishi bilan sekundlar ichida yangilanishi uchun)
    if (!isRealtimeSubscribed) {
      isRealtimeSubscribed = true;
      supabase
        .channel('public:app_settings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_settings' },
          (payload) => {
          const item = payload.new;
          if (!item) return;

          if (item.setting_key === 'ads_enabled') {
            currentSettings.ads_enabled = item.setting_value === true || item.setting_value === 'true';
          } else if (item.setting_key === 'premium_mode_enabled') {
            currentSettings.premium_mode_enabled = item.setting_value === true || item.setting_value === 'true';
          } else if (item.setting_key === 'videos_enabled') {
            currentSettings.videos_enabled = item.setting_value === true || item.setting_value === 'true';
          } else if (item.setting_key === 'latest_announcement') {
            currentSettings.latest_announcement = item.setting_value && typeof item.setting_value === 'object'
              ? item.setting_value
              : typeof item.setting_value === 'string' && item.setting_value.startsWith('{')
                ? JSON.parse(item.setting_value)
                : item.setting_value || null;
          } else if (item.setting_key === 'free_books_count') {
            currentSettings.free_books_count = item.setting_value !== undefined ? Number(item.setting_value) : 1;
          } else if (item.setting_key === 'free_book_ids') {
            try {
              const val = Array.isArray(item.setting_value)
                ? item.setting_value
                : typeof item.setting_value === 'string'
                  ? JSON.parse(item.setting_value)
                  : [1];
              currentSettings.free_book_ids = Array.isArray(val) ? val.map(Number) : [1];
            } catch (e) {
              currentSettings.free_book_ids = [1];
            }
          } else if (item.setting_key === 'premium_monthly_original_price') {
            currentSettings.premium_monthly_original_price = Number(item.setting_value) || 59000;
          } else if (item.setting_key === 'premium_monthly_price') {
            currentSettings.premium_monthly_price = Number(item.setting_value) || 29000;
          } else if (item.setting_key === 'single_book_original_price') {
            currentSettings.single_book_original_price = Number(item.setting_value) || 35000;
          } else if (item.setting_key === 'single_book_price') {
            currentSettings.single_book_price = Number(item.setting_value) || 19000;
          }

          setStorageItem(STORAGE_KEY_SETTINGS, currentSettings);
          notifyListeners();
        }
      )
      .subscribe();
    }
  } catch (err) {
    console.warn('[AppSettings] Supabase load error:', err?.message);
  }

  return currentSettings;
}

/**
 * Yangi xarid (kirim) tranzaksiyasini Supabase app_settings (transactions_data) ga yozish
 */
export async function recordTransaction({
  type = 'income',
  userName = 'Foydalanuvchi',
  username = 'user',
  itemTitle = 'VIP Obuna',
  itemType = 'vip',
  amount = 29000,
  paymentMethod = 'Click',
  note = ''
}) {
  if (!(typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS === 'true')) throw new Error('Mock payments disabled.');
  const session = captureStorageSession();
  const owner = session.owner;
  if (!owner) throw new Error('Authentication required.');
  const newTx = {
    mock: true,
    id: 'tx_' + Date.now(),
    type,
    user_name: userName,
    username,
    user_avatar: '👤',
    item_title: itemTitle,
    item_type: itemType,
    amount: Number(amount) || 0,
    payment_method: paymentMethod,
    status: 'mock',
    created_at: new Date().toISOString(),
    note
  };

  // 1. Mahalliy xotiraga qo'shish
  try {
    const localTxs = (await getStorageItem('ingly_transactions', [], session)) || [];
    const updatedLocal = [newTx, ...localTxs];
    await setStorageItem('ingly_transactions', updatedLocal, session);
  } catch (e) {}

  return newTx;
}

export default {
  initAppSettings,
  getAppSettings,
  onSettingsChange,
  recordTransaction,
};
