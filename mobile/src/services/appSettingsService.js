/**
 * Ingly Mobile App - App Settings & Live Feature Flags Service
 * 
 * Supabase bulut bazasidagi `app_settings` jadvali bilan real-time bog'lanadi.
 * Admin paneldan reklama yoki VIP rejim yoqilganda/o'chirilganda,
 * mobil ilovada darhol aks etadi.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getStorageItem, setStorageItem } from './storage';

const STORAGE_KEY_SETTINGS = 'ingly_cached_app_settings';

// Boshlang'ich standart parametrlar (TZ.txt bo'yicha)
let currentSettings = {
  ads_enabled: false,
  premium_mode_enabled: false,
  free_books_count: 6,
  daily_goal_default: 20,
};

const listeners = new Set();

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
      currentSettings = { ...currentSettings, ...cached };
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
          currentSettings.free_books_count = Number(item.setting_value) || 6;
        } else if (item.setting_key === 'daily_goal_default') {
          currentSettings.daily_goal_default = Number(item.setting_value) || 20;
        }
      });

      await setStorageItem(STORAGE_KEY_SETTINGS, currentSettings);
      notifyListeners();
    }

    // 3. Supabase Realtime obunasi (Admin o'zgartirishi bilan sekundlar ichida yangilanishi uchun)
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
          } else if (item.setting_key === 'free_books_count') {
            currentSettings.free_books_count = Number(item.setting_value) || 6;
          }

          setStorageItem(STORAGE_KEY_SETTINGS, currentSettings);
          notifyListeners();
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('[AppSettings] Supabase load error:', err?.message);
  }

  return currentSettings;
}

export default {
  initAppSettings,
  getAppSettings,
  onSettingsChange,
};
