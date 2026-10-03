/**
 * Ingly Mobile App - Supabase Client
 * 
 * PostgreSQL / Supabase serveri bilan bog'lanish uchun asosiy mijoz.
 * React Native muhitida sessiya va tokenlarni avtomatik saqlaydi.
 */

import { getStorageItem, setStorageItem, removeStorageItem } from './storage';

// Standart / Environment sozlamalari
const DEFAULT_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-placeholder';

let supabaseClient = null;
let currentUrl = DEFAULT_SUPABASE_URL;
let currentAnonKey = DEFAULT_SUPABASE_ANON_KEY;

// React Native uchun maxsus AsyncStorage adapter
const customStorageAdapter = {
  getItem: async (key) => {
    try {
      return await getStorageItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await setStorageItem(key, value);
    } catch (e) {
      console.warn('Storage setItem xatosi:', e);
    }
  },
  removeItem: async (key) => {
    try {
      await removeStorageItem(key);
    } catch (e) {
      console.warn('Storage removeItem xatosi:', e);
    }
  },
};

/**
 * Supabase mijozini xavfsiz initsializatsiya qilish
 */
export function initSupabase(url = currentUrl, anonKey = currentAnonKey) {
  currentUrl = url;
  currentAnonKey = anonKey;

  try {
    // Dinamik import yoki @supabase/supabase-js tekshiruvi
    const { createClient } = require('@supabase/supabase-js');
    
    supabaseClient = createClient(currentUrl, currentAnonKey, {
      auth: {
        storage: customStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    return supabaseClient;
  } catch (error) {
    console.warn(
      '[@supabase/supabase-js] kutubxonasi mavjud emas yoki yuklanmadi. Mock/Fallback rejimida ishlanmoqda.',
      error?.message
    );

    // Fallback Mock Client - Ilova kutubxona o'rnatilmagan paytda ham ishdan chiqmasligi uchun
    supabaseClient = {
      isMock: true,
      auth: {
        signUp: async () => ({ data: { user: null }, error: new Error('Supabase sozlanmagan') }),
        signInWithPassword: async () => ({ data: { user: null }, error: new Error('Supabase sozlanmagan') }),
        signOut: async () => ({ error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: [], error: null }),
        update: () => Promise.resolve({ data: [], error: null }),
        delete: () => Promise.resolve({ data: [], error: null }),
      }),
      rpc: async (functionName, params) => {
        console.warn(`[Supabase Mock RPC] ${functionName} chaqirildi:`, params);
        return { data: { success: false, message: 'Supabase URL yoki Anon key kiritilmagan' }, error: null };
      },
    };

    return supabaseClient;
  }
}

// Boshlang'ich initsializatsiya
export const supabase = initSupabase();

/**
 * Supabase haqiqiy loyihaga ulanganligini tekshirish
 */
export function isSupabaseConfigured() {
  return (
    currentUrl &&
    !currentUrl.includes('your-project.supabase.co') &&
    currentAnonKey &&
    currentAnonKey !== 'your-anon-key-placeholder' &&
    !supabaseClient?.isMock
  );
}

/**
 * Dinamik ravishda Supabase kalitlarini o'zgartirish (masalan: Admin sozlamalaridan)
 */
export function configureSupabase(newUrl, newAnonKey) {
  return initSupabase(newUrl, newAnonKey);
}

export default supabase;
