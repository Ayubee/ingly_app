/**
 * INGLY MOBILE - USER CONTEXT
 * TZ.txt 8-bo'limiga 100% mos ravishda to'liq Auth:
 * - Bir xil login yoki telefon raqam bilan qayta ro'yxatdan o'tishni bloklash (Unique Constraint)
 * - Parol va loginni to'g'ri tekshirish
 * - Google Sign-In
 * - Shaxsiy natijalarni har bir foydalanuvchi hisobida alohida 0 dan saqlash
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { getStorageItem, STORAGE_KEYS, setStorageAccountId, purgeLegacyCredentials, authStorage,
  captureStorageSession, isStorageSessionCurrent, onLocalStateChange, mutateUserProfile, saveWordProgress,
  recordLocalQuiz, resetLocalProgress, normalizeDailyProfile, getLocalMutationState } from '../services/storage.js';
import { fetchUserRemoteStatus } from '../services/userService.js';
import { startAutoSync, stopAutoSync } from '../services/syncEngine.js';
import { readCachedAuthSession } from '../services/sessionCache.js';
import allWords from '../data/all_words.json';
import { syncUserLeaderboardScore } from '../services/leaderboardService.js';
import { supabase } from '../services/supabaseClient.js';
import { registerAccount, loginAccount, verifyRegistration, changeAccountPassword } from '../services/authService.js';

const UserContext = createContext();
function mergeLocalUser(trusted, local) {
  const { password, password_hash, ...safe } = local;
  return { ...trusted, ...normalizeDailyProfile(safe), isPremium: trusted.isPremium,
    premiumUntil: trusted.premiumUntil, unlockedBooks: trusted.unlockedBooks, purchasedBooks: [] };
}
const wordIndex = new Map(allWords.map(word => [Number(word.id), word]));
const unitIndex = new Map();
const bookSizes = {};
for (const word of allWords) {
  const key = `${word.book}:${word.unit}`;
  if (!unitIndex.has(key)) unitIndex.set(key, []);
  unitIndex.get(key).push(Number(word.id));
  bookSizes[word.book] = (bookSizes[word.book] || 0) + 1;
}

export const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000; // 180 kun (~6 oy)

/**
 * Parol oxirgi marta o'rnatilganidan buyon 6 oy (180 kun) o'tganligini tekshirish.
 * TALAB: Ilovaga kirishi bilanoq xabar chiqmasin! Ro'yxatdan o'tgan yoki oxirgi o'zgartirilgan kundan 6 oy (180 kun) o'tgachgina chiqadi.
 */
export const isPasswordOlderThan6Months = (user) => {
  if (!user || !user.isLoggedIn) return false;
  // Google orqali kirgan va paroli yo'q bo'lsa, eslatma kerak emas
  if (user.authMethod === 'google') return false;

  // Foydalanuvchi ro'yxatdan o'tgan sana (createdAt) yoki paroli yangilangan sana (passwordChangedAt)
  const regDate = user.createdAt || user.created_at;
  const changedAt = user.passwordChangedAt || user.password_changed_at || regDate;

  // Agar sana bo'lmasa, darhol xabar chiqmasligi uchun yangi ro'yxatdan o'tgan deb hisoblab false qaytaramiz
  if (!changedAt) {
    return false;
  }

  const changeTime = new Date(changedAt).getTime();
  if (isNaN(changeTime)) {
    return false;
  }

  const ageMs = Date.now() - changeTime;
  // Qat'iy 6 oy (180 kun) o'tgandagina ogohlantirish beriladi
  return ageMs >= SIX_MONTHS_MS;
};

export const INITIAL_USER = {
  isLoggedIn: false,
  name: '',
  phone: '',
  username: '',
  passwordChangedAt: null, // Qachon oxirgi marta parol qo'yilgan yoki o'zgartirilgan
  lastPasswordReminderDate: null, // Oxirgi marta 6 oylik eslatma ko'rsatilgan kun (YYYY-MM-DD)
  createdAt: null, // Ro'yxatdan o'tgan sana
  avatar: '👨‍🎓',
  authMethod: 'credentials', // 'credentials' | 'google'
  streakDays: 0,
  dailyGoal: 20,
  wordsLearnedToday: 0,
  totalWordsLearned: 0,
  reviewedWordsCount: 0,
  hardWordsCount: 0,
  accuracy: 0,
  activeBook: 1,
  activeUnit: 1,
  isPremium: false,
  premiumUntil: null, // VIP obuna tugash sanasi (ISO)
  unlockedBooks: [1], // Foydalanuvchi uchun ochiq kitoblar (Book 1 har doim bepul)
  purchasedBooks: [], // Foydalanuvchi alohida xarid qilgan kitoblar ID lari [2, 3...]
  reminderTime: '20:00',
  notificationsEnabled: true,
  soundEnabled: true,
  lastActiveDate: null,
  bookProgress: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  },
  bookLearnedCounts: {},
  completedUnits: {},
};

export function UserProvider({ children }) {
  const [user, setUser] = useState(INITIAL_USER);
  const [isLoading, setIsLoading] = useState(true);

  const identityRef = useRef(null);
  const generation = useRef(0);
  const loggingOut = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const uiSession = useRef(null);
  // Event handlers retain the session that rendered them, including A→B→A.
  const renderSession = uiSession.current || captureStorageSession(null);
  const [mockEntitlements, setMockEntitlements] = useState({ vip: false, books: [] });
  const mockEnabled = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS === 'true';

  const applySession = async (session) => {
    const turn = ++generation.current;
    const id = loggingOut.current ? null : session?.user?.id || null;
    const switched = identityRef.current !== id;
    identityRef.current = id;
    const oldToken = captureStorageSession();
    setStorageAccountId(id, session?.access_token || null);
    const token = captureStorageSession(id);
    if (!isStorageSessionCurrent(oldToken)) stopAutoSync();
    if (switched || !id) {
      setUser(INITIAL_USER);
      setMockEntitlements({ vip: false, books: [] });
    }
    if (!id) { uiSession.current = null; setIsLoading(false); return; }
    let saved;
    try { saved = normalizeDailyProfile(await getStorageItem(STORAGE_KEYS.USER_PROFILE, null, id)); }
    catch { saved = null; Alert.alert('Local storage', 'Saqlangan ma’lumotni o‘qib bo‘lmadi. Asl nusxa saqlandi.'); }
    if (turn !== generation.current || !isStorageSessionCurrent(token)) return;
    uiSession.current = token;
    if (switched && saved?.id === id) {
      const { password, password_hash, ...safe } = saved;
      // Credentials and entitlement flags are never restored from a profile cache.
      setUser({ ...INITIAL_USER, ...safe, id, isLoggedIn: true, isPremium: false,
        premiumUntil: null, unlockedBooks: [1], purchasedBooks: [] });
    } else if (switched) {
      setUser({ ...INITIAL_USER, id, isLoggedIn: true });
    } else {
      // Re-render account-bound screens after a new SDK session generation.
      setUser(prev => saved?.id === id ? mergeLocalUser(prev, saved) : { ...prev });
    }
    setIsLoading(false);
    startAutoSync();
    // Profile validation runs in the background; local learning never awaits it.
    (async () => { try {
      const before = await getLocalMutationState(token);
      const profile = await fetchUserRemoteStatus(token);
      if (turn !== generation.current || !isStorageSessionCurrent(token)) return;
      if (!profile || profile.id !== id || profile.auth_user_id !== id || profile.is_blocked) {
        await logout();
        return;
      }
      const next = await mutateUserProfile((prev, state) => {
        const pendingPreferences = before.pendingPreferences || state.sequence !== before.sequence || state.outbox.some(op => op.changes.preferences);
        return ({ ...INITIAL_USER, ...prev, id, isLoggedIn: true,
        name: pendingPreferences ? prev.name : profile.full_name, username: profile.username, phone: profile.phone || '',
        avatar: pendingPreferences ? prev.avatar : profile.avatar_url || prev.avatar,
        dailyGoal: pendingPreferences ? prev.dailyGoal : profile.daily_goal, createdAt: profile.created_at,
        isPremium: profile.is_premium, premiumUntil: profile.premium_until,
        unlockedBooks: profile.is_premium ? [1,2,3,4,5,6] : [1], purchasedBooks: [] });
      }, INITIAL_USER, () => ({}), token);
      if (isStorageSessionCurrent(token)) setUser(next);
    } catch {
      // Only the Auth SDK session can restore offline identity; never legacy local credentials.
    } })();
  };
  useEffect(() => {
    let mounted = true;
    let authEvent = 0;
    (async () => {
      await purgeLegacyCredentials();
      const cached = await readCachedAuthSession();
      if (mounted && authEvent === 0) await applySession(cached);
      const eventBefore = authEvent;
      const { data, error } = await supabase.auth.getSession();
      if (mounted && eventBefore === authEvent) await applySession(error ? null : data.session);
    })().catch(() => { if (mounted && authEvent === 0) applySession(null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const event = ++authEvent;
      // Invalidate old work synchronously, before deferring outside the SDK lock.
      setStorageAccountId(loggingOut.current ? null : session?.user?.id, session?.access_token || null);
      stopAutoSync();
      setTimeout(async () => {
        if (mounted && event === authEvent) await applySession(session);
      }, 0);
    });
    const offLocal = onLocalStateChange(async () => {
      const token = captureStorageSession();
      try {
        const next = await getStorageItem(STORAGE_KEYS.USER_PROFILE, null, token);
        if (next?.id === token.owner && isStorageSessionCurrent(token))
          setUser(prev => isStorageSessionCurrent(token) ? mergeLocalUser(prev, next) : prev);
      } catch {}
    });
    return () => { mounted = false; generation.current++; listener.subscription.unsubscribe(); offLocal(); stopAutoSync(); setStorageAccountId(null); };
  }, []);

  const saveUserData = async (patch, changesFor = () => ({}), token = renderSession) => {
    const id = identityRef.current;
    if (!id || token.owner !== id || !isStorageSessionCurrent(token)) throw new Error('Account changed.');
    const next = await mutateUserProfile(prev => ({ ...prev, ...patch, id, isLoggedIn: true,
      isPremium: userRef.current.isPremium, premiumUntil: userRef.current.premiumUntil,
      unlockedBooks: userRef.current.unlockedBooks, purchasedBooks: [] }), { ...INITIAL_USER, ...userRef.current }, changesFor, token);
    if (!isStorageSessionCurrent(token)) return;
    setUser(next);
    syncUserLeaderboardScore(next).catch(() => {});
  };
  const register = async (form) => {
    if (loggingOut.current) return { success: false, error: 'Chiqish yakunlanishini kuting.' };
    try {
      const data = await registerAccount(form);
      if (!data.session) return { success: true, needsVerification: true, phone: data.phone };
      await applySession(data.session);
      return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
  };
  const confirmRegistration = async (phone, token) => {
    if (loggingOut.current) return { success: false, error: 'Chiqish yakunlanishini kuting.' };
    try { const data = await verifyRegistration(phone, token); await applySession(data.session); return { success: true }; }
    catch (error) { return { success: false, error: error.message }; }
  };
  const login = async (form) => {
    if (loggingOut.current) return { success: false, error: 'Chiqish yakunlanishini kuting.' };
    try {
      const data = await loginAccount(form);
      if (data.needsVerification) return { success: true, needsVerification: true, phone: data.phone };
      await applySession(data.session); return { success: true };
    }
    catch (error) { return { success: false, error: error.message }; }
  };
  const loginWithGoogle = async () => {
    Alert.alert('Google', 'Google OAuth hali sozlanmagan. Telefon va parol orqali kiring.');
    return { success: false, error: 'Google OAuth is disabled.' };
  };
  const logout = async () => {
    // Detach immediately; retain per-account progress/outbox for Phase 3 synchronization.
    loggingOut.current = true;
    await applySession(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } finally {
      await authStorage.removeItem('ingly_supabase_auth_v2');
      await authStorage.removeItem('ingly_supabase_auth_v2-user');
      await applySession(null);
      loggingOut.current = false;
    }
  };

  // 5. Profil ma'lumotlarini tahrirlash (Ism, Avatar, Telefon, Kunlik Maqsad)
  const updateProfile = async (updates) => {
    if (updates.phone && updates.phone !== user.phone || updates.username && updates.username !== user.username) return { success: false, error: 'Telefon/login almashtirish uchun tasdiqlangan server oqimi kerak.' };
    const allowed = ['name','avatar','dailyGoal','reminderTime','notificationsEnabled','soundEnabled'];
    updates = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
    let cleanName = user.name;
    if (updates.name !== undefined) {
      const trimmed = String(updates.name).trim();
      if (!trimmed) {
        return { success: false, error: 'Ism bo\'sh bo\'lishi mumkin emas!' };
      }
      cleanName = trimmed;
    }

    let cleanPhone = user.phone;
    if (updates.phone !== undefined) {
      const sanitized = String(updates.phone).replace(/[^\d+\s\-()]/g, '').trim();
      const digits = sanitized.replace(/\D/g, '');
      if (sanitized && digits.length < 9) {
        return { success: false, error: 'Telefon raqami kamida 9 ta raqamdan iborat bo\'lishi kerak!' };
      }
      cleanPhone = sanitized;
    }

    const patch = { ...updates };
    if (updates.name !== undefined) patch.name = cleanName;
    if (updates.dailyGoal !== undefined) patch.dailyGoal = Math.max(1, Math.min(500, Number(updates.dailyGoal) || 20));
    try { await saveUserData(patch, next => ({ preferences: Object.fromEntries(allowed.map(key => [key, next[key]])) })); }
    catch (error) { return { success: false, error: error.message }; }
    return { success: true };
  };

  const recordWordLearned = async (wordId, status = 'mastered') => {
    const token = renderSession;
    const word = wordIndex.get(Number(wordId));
    if (!word) throw new Error('Unknown textbook word.');
    const result = await saveWordProgress(wordId, status, { book: word.book, unit: word.unit,
      bookSize: bookSizes[word.book], unitWordIds: unitIndex.get(`${word.book}:${word.unit}`),
      defaults: { ...INITIAL_USER, ...userRef.current } }, token);
    if (isStorageSessionCurrent(token)) setUser(prev => isStorageSessionCurrent(token) ? mergeLocalUser(prev, result.profile) : prev);
  };

  const recordQuizResult = async (score, total) => {
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(score)) return;
    const token = renderSession;
    const next = await recordLocalQuiz(score, total, { ...INITIAL_USER, ...userRef.current }, token);
    if (isStorageSessionCurrent(token)) setUser(prev => isStorageSessionCurrent(token) ? mergeLocalUser(prev, next) : prev);
  };

  const resetProgress = async () => {
    const token = renderSession;
    const next = await resetLocalProgress(INITIAL_USER, token);
    if (isStorageSessionCurrent(token)) setUser(prev => isStorageSessionCurrent(token) ? mergeLocalUser(prev, next) : prev);
  };

  const setActiveLesson = async (bookNumber, unitNumber) => {
    const activeBook = Math.max(1, Math.min(6, parseInt(bookNumber, 10) || 1));
    const activeUnit = Math.max(1, Math.min(30, parseInt(unitNumber, 10) || 1));
    await saveUserData({ activeBook, activeUnit }, next => ({ lesson: { activeBook: next.activeBook, activeUnit: next.activeUnit } }));
  };

  const changePassword = async ({ oldPassword, newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) return { success: false, error: 'Parollar mos emas.' };
    try {
      const token = renderSession;
      await changeAccountPassword(oldPassword, newPassword);
      await saveUserData({ passwordChangedAt: new Date().toISOString() }, () => ({}), token);
      return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
  };

  const dismissPasswordReminder = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updated = {
      lastPasswordReminderDate: todayStr,
    };
    await saveUserData(updated);
  };

  // 12. VIP Oylik Obunani faollashtirish (Click, Payme yoki Bank Karta to'lovidan so'ng)
  const subscribeVipMonthly = async () => {
    if (!mockEnabled || !identityRef.current) return { success: false, error: 'Mock payments disabled.' };
    setMockEntitlements(prev => ({ ...prev, vip: true }));
    return { success: true, mock: true };
  };
  const purchaseBook = async (bookId) => {
    if (!mockEnabled || !identityRef.current) return { success: false, error: 'Mock payments disabled.' };
    const book = Number(bookId);
    if (!Number.isInteger(book) || book < 1 || book > 6) return { success: false, error: 'Invalid book.' };
    setMockEntitlements(prev => ({ ...prev, books: [...new Set([...prev.books, book])] }));
    return { success: true, mock: true };
  };

  // VIP obuna ayni paytda faolmi? (Tugash muddati o'tib ketmaganmi)
  const isVipActive = Boolean(user?.isLoggedIn && ((mockEnabled && mockEntitlements.vip) ||
    (user.isPremium && (!user.premiumUntil || new Date(user.premiumUntil).getTime() > Date.now()))));

  // Kitob ochilganmi yoki bepulmi? (Admin tomonidan bepul qilingan kitoblar, VIP yoki xarid qilingan bo'lishi shart)
  const isBookPurchasedOrFree = (bookId, freeBooksCount = 1, premiumModeEnabled = true, freeBookIds = null) => {
    if (!premiumModeEnabled) return true; // Agar admin pullik rejimni o'chirsa, hamma kitob ochiq
    if (mockEnabled && mockEntitlements.books.includes(Number(bookId))) return true;
    if (isVipActive) return true;          // VIP obunachi uchun barcha kitoblar ochiq
    const num = Number(bookId);
    if (Array.isArray(freeBookIds) && freeBookIds.includes(num)) return true; // Admin alohida tekin qilgan kitob
    if (num <= freeBooksCount) return true; // Bepul kitoblar soni bo'yicha
    if (num === 1) return true;
    return false;
  };

  const isPasswordExpired = isPasswordOlderThan6Months(user);

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        register,
        login,
        loginWithGoogle,
        confirmRegistration,
        logout,
        updateProfile,
        recordWordLearned,
        recordQuizResult,
        resetProgress,
        setActiveLesson,
        changePassword,
        dismissPasswordReminder,
        subscribeVipMonthly,
        purchaseBook,
        isVipActive,
        isBookPurchasedOrFree,
        isPasswordExpired,
        isPasswordOlderThan6Months,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser UserProvider ichida ishlatilishi shart');
  }
  return context;
}
