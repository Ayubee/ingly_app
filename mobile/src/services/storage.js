/**
 * Ingly Mobile App - Local Storage & Offline Action Queue Service
 * 
 * AsyncStorage asosida ishlaydi. 
 * Internet bo'lmaganda so'z statuslarini ('mastered', 'review', 'hard'), 
 * kunlik streak va offline harakatlar navbatini (@ingly_sync_queue) saqlaydi.
 */

// Xotira kalitlari (Storage Keys)
export const STORAGE_KEYS = {
  WORD_PROGRESS: '@ingly_word_progress',   // { [wordId]: { status, reviewed_at, review_count, is_favorite } }
  SYNC_QUEUE: '@ingly_sync_queue',         // Array of { word_id, status, reviewed_at, is_favorite }
  USER_STREAKS: '@ingly_user_streaks',     // { current_streak, max_streak, last_activity_date, words_learned_today, daily_goal }
  FAVORITES: '@ingly_favorites',           // Array of wordId
  APP_SETTINGS: '@ingly_app_settings',     // Foydalanuvchi ilova sozlamalari
  USER_PROFILE: '@ingly_user_profile',     // Foydalanuvchi profili kesh
  REGISTERED_USERS: '@ingly_registered_users', // Ro'yxatdan o'tgan barcha foydalanuvchilar bazasi
  CUSTOM_WORDS: '@ingly_custom_words',     // Foydalanuvchi o'zi qo'shgan shaxsiy so'zlar va kartochkalar
  SAVED_CARDS: '@ingly_saved_cards',       // Foydalanuvchi saqlab qo'ygan bank kartalari
};

// In-memory fallback (agar AsyncStorage bo'lmasa yoki xatolik bersa)
const memoryStore = new Map();

/**
 * Universal AsyncStorage yuklagich (Native, Web va Fallback moslashuvchanligi bilan)
 */
function getNativeStorage() {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        getItem: async (k) => window.localStorage.getItem(k),
        setItem: async (k, v) => window.localStorage.setItem(k, v),
        removeItem: async (k) => window.localStorage.removeItem(k),
        clear: async () => window.localStorage.clear(),
      };
    }
    return {
      getItem: async (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
      setItem: async (k, v) => { memoryStore.set(k, String(v)); },
      removeItem: async (k) => { memoryStore.delete(k); },
      clear: async () => { memoryStore.clear(); },
    };
  }
}

const nativeStorage = getNativeStorage();

/**
 * Xom ma'lumotni o'qish (JSON parser bilan)
 */
export async function getStorageItem(key, defaultValue = null) {
  try {
    const value = await nativeStorage.getItem(key);
    if (value === null || value === undefined) return defaultValue;
    return JSON.parse(value);
  } catch {
    try {
      const raw = await nativeStorage.getItem(key);
      return raw !== null ? raw : defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

/**
 * Ma'lumotni saqlash (JSON stringify bilan)
 */
export async function setStorageItem(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await nativeStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`Storage setItem xatosi [${key}]:`, error);
    return false;
  }
}

/**
 * Kalitni o'chirish
 */
export async function removeStorageItem(key) {
  try {
    await nativeStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Storage removeItem xatosi [${key}]:`, error);
    return false;
  }
}

// =============================================================================
// 1. SO'ZLAR PROGRESSI (Word Learning Progress)
// =============================================================================

/**
 * Barcha so'zlarning lokal progress xaritasini olish
 * @returns {Promise<Object>} { [wordId]: { status: 'mastered'|'review'|'hard', ... } }
 */
export async function getAllProgress() {
  return await getStorageItem(STORAGE_KEYS.WORD_PROGRESS, {});
}

/**
 * Bitta so'zning o'rganilish holatini olish
 */
export async function getWordProgress(wordId) {
  const allProgress = await getAllProgress();
  return allProgress[String(wordId)] || null;
}

/**
 * So'zning o'rganilish progressini saqlash va oflayn navbatga qo'shish
 * @param {number|string} wordId So'z ID raqami
 * @param {'mastered'|'review'|'hard'} status O'rganish holati
 * @param {Object} options Qo'shimcha parametrlar (is_favorite, next_review_date)
 */
export async function saveWordProgress(wordId, status, options = {}) {
  const validStatus = ['mastered', 'review', 'hard'].includes(status) ? status : 'review';
  const nowIso = new Date().toISOString();
  const idStr = String(wordId);

  // 1. Lokal xotiradagi progressni yangilash
  const allProgress = await getAllProgress();
  const existing = allProgress[idStr] || { review_count: 0 };

  const updatedItem = {
    word_id: Number(wordId),
    status: validStatus,
    review_count: (existing.review_count || 0) + 1,
    last_reviewed_at: nowIso,
    next_review_date: options.next_review_date || null,
    is_favorite: options.is_favorite !== undefined ? !!options.is_favorite : (existing.is_favorite || false),
  };

  allProgress[idStr] = updatedItem;
  await setStorageItem(STORAGE_KEYS.WORD_PROGRESS, allProgress);

  // 2. Oflayn sinxronizatsiya navbatiga (Sync Queue) qo'shish
  await addToSyncQueue({
    word_id: Number(wordId),
    status: validStatus,
    reviewed_at: nowIso,
    is_favorite: updatedItem.is_favorite,
    next_review_date: updatedItem.next_review_date,
  });

  // 3. Lokal kunlik streak hisobini oshirish
  await incrementDailyWordsLearned(1);

  return updatedItem;
}

// =============================================================================
// 2. OFLAYN NAVBAT (Offline Action Queue)
// =============================================================================

/**
 * Serverga yuborilishi kutilayotgan oflayn harakatlar ro'yxatini olish
 * @returns {Promise<Array>} Array of { word_id, status, reviewed_at, is_favorite }
 */
export async function getSyncQueue() {
  return await getStorageItem(STORAGE_KEYS.SYNC_QUEUE, []);
}

/**
 * Navbatga yangi oflayn harakatni qo'shish (Duplicate bo'lsa yangi holat bilan almashtiradi)
 */
export async function addToSyncQueue(actionItem) {
  try {
    const queue = await getSyncQueue();
    const itemWordId = Number(actionItem.word_id);

    // Agar ushbu so'z bo'yicha navbatda yozuv bo'lsa, uni yangilaymiz (debouncing / deduplication)
    const existingIndex = queue.findIndex((q) => Number(q.word_id) === itemWordId);

    const newEntry = {
      word_id: itemWordId,
      status: actionItem.status || 'review',
      reviewed_at: actionItem.reviewed_at || new Date().toISOString(),
      is_favorite: !!actionItem.is_favorite,
      next_review_date: actionItem.next_review_date || null,
      client_timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = newEntry;
    } else {
      queue.push(newEntry);
    }

    await setStorageItem(STORAGE_KEYS.SYNC_QUEUE, queue);
    return queue;
  } catch (error) {
    console.error('addToSyncQueue xatosi:', error);
    return [];
  }
}

/**
 * Muvaffaqiyatli sinxronizatsiya qilingan elementlarni navbatdan o'chirish
 * @param {Array<number>} syncedWordIds Sinxronlangan so'z ID lari (yoki bo'sh bo'lsa barchasini tozalash)
 */
export async function clearSyncQueue(syncedWordIds = null) {
  try {
    if (!syncedWordIds || syncedWordIds.length === 0) {
      await setStorageItem(STORAGE_KEYS.SYNC_QUEUE, []);
      return [];
    }

    const queue = await getSyncQueue();
    const syncedSet = new Set(syncedWordIds.map(Number));
    const remainingQueue = queue.filter((item) => !syncedSet.has(Number(item.word_id)));

    await setStorageItem(STORAGE_KEYS.SYNC_QUEUE, remainingQueue);
    return remainingQueue;
  } catch (error) {
    console.error('clearSyncQueue xatosi:', error);
    return [];
  }
}

// =============================================================================
// 3. KUNLIK STREAK VA MAQSAD (User Streaks & Daily Goal)
// =============================================================================

const DEFAULT_STREAK = {
  current_streak: 0,
  max_streak: 0,
  last_activity_date: null,
  words_learned_today: 0,
  daily_goal: 20,
};

/**
 * Foydalanuvchining lokal streak holatini olish
 */
export async function getUserStreak() {
  const streak = await getStorageItem(STORAGE_KEYS.USER_STREAKS, DEFAULT_STREAK);
  const todayStr = new Date().toISOString().split('T')[0];

  // Agar yangi kunga o'tgan bo'lsa, words_learned_today ni nollaymiz
  if (streak.last_activity_date !== todayStr) {
    // Agar oxirgi faollik kechadan oldinroq bo'lsa, current_streak ham to'xtaydi
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let currentStreak = streak.current_streak;
    if (streak.last_activity_date && streak.last_activity_date !== yesterdayStr) {
      currentStreak = 0; // 1 kundan ko'p faoliyat bo'lmagan
    }

    const resetDaily = {
      ...streak,
      current_streak: currentStreak,
      words_learned_today: 0,
    };
    await setStorageItem(STORAGE_KEYS.USER_STREAKS, resetDaily);
    return resetDaily;
  }

  return streak;
}

/**
 * Serverdan kelgan yoki yangilangan streak ma'lumotini saqlash
 */
export async function updateUserStreak(streakData) {
  const current = await getUserStreak();
  const updated = {
    ...current,
    ...streakData,
  };
  await setStorageItem(STORAGE_KEYS.USER_STREAKS, updated);
  return updated;
}

/**
 * Bugun o'rganilgan so'zlar hisobini 1 taga oshirish va streakni tekshirish
 */
export async function incrementDailyWordsLearned(count = 1) {
  const streak = await getUserStreak();
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newCurrentStreak = streak.current_streak;

  if (streak.last_activity_date !== todayStr) {
    if (streak.last_activity_date === yesterdayStr) {
      newCurrentStreak += 1;
    } else {
      newCurrentStreak = 1;
    }
  }

  const updated = {
    ...streak,
    current_streak: newCurrentStreak,
    max_streak: Math.max(streak.max_streak || 0, newCurrentStreak),
    last_activity_date: todayStr,
    words_learned_today: (streak.words_learned_today || 0) + count,
  };

  await setStorageItem(STORAGE_KEYS.USER_STREAKS, updated);
  return updated;
}

// =============================================================================
// 4. SEVIMLI SO'ZLAR (Favorites)
// =============================================================================

/**
 * Barcha sevimli so'zlar ro'yxatini olish
 */
export async function getFavorites() {
  return await getStorageItem(STORAGE_KEYS.FAVORITES, []);
}

/**
 * So'zni sevimlilarga qo'shish yoki olib tashlash
 */
export async function toggleFavorite(wordId) {
  const idNum = Number(wordId);
  const favorites = await getFavorites();
  const index = favorites.indexOf(idNum);

  let isFav = false;
  let newFavs = [];

  if (index >= 0) {
    newFavs = favorites.filter((id) => id !== idNum);
    isFav = false;
  } else {
    newFavs = [...favorites, idNum];
    isFav = true;
  }

  await setStorageItem(STORAGE_KEYS.FAVORITES, newFavs);

  // Progress obyektida ham is_favorite qiymatini yangilaymiz
  const allProgress = await getAllProgress();
  if (allProgress[String(idNum)]) {
    allProgress[String(idNum)].is_favorite = isFav;
    await setStorageItem(STORAGE_KEYS.WORD_PROGRESS, allProgress);
  }

  // Oflayn navbatga sevimli holati o'zgarganini qo'shamiz
  await addToSyncQueue({
    word_id: idNum,
    status: allProgress[String(idNum)]?.status || 'review',
    is_favorite: isFav,
    reviewed_at: new Date().toISOString(),
  });

  return isFav;
}

/**
 * Barcha lokal ma'lumotlarni tozalash (Chiqish yoki Reset paytida)
 */
export async function clearAllLocalData() {
  try {
    await nativeStorage.clear();
    memoryStore.clear();
    return true;
  } catch (error) {
    console.error('clearAllLocalData xatosi:', error);
    return false;
  }
}

/**
 * Foydalanuvchi qo'shgan shaxsiy so'zlar ro'yxatini olish
 */
export async function getCustomWords() {
  return (await getStorageItem(STORAGE_KEYS.CUSTOM_WORDS, [])) || [];
}

/**
 * Yangi shaxsiy so'z qo'shish
 */
export async function addCustomWord(wordItem) {
  const list = await getCustomWords();
  const newItem = {
    id: wordItem.id || 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    original: (wordItem.original || '').trim(),
    translated: (wordItem.translated || '').trim(),
    phonetic: wordItem.phonetic || '',
    pos: wordItem.pos || '',
    definition: wordItem.definition || '',
    example: wordItem.example || '',
    learned: !!wordItem.learned,
    learned_at: wordItem.learned ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
    review_count: 0
  };
  const updated = [newItem, ...list];
  await setStorageItem(STORAGE_KEYS.CUSTOM_WORDS, updated);
  return newItem;
}

/**
 * Shaxsiy so'z holatini yangilash (Yodlangan / Yodlanmagan)
 */
export async function setCustomWordLearnedStatus(wordId, isLearned) {
  const list = await getCustomWords();
  const updated = list.map(item => {
    if (item.id === wordId) {
      return {
        ...item,
        learned: isLearned,
        learned_at: isLearned ? new Date().toISOString() : null,
        review_count: (item.review_count || 0) + 1
      };
    }
    return item;
  });
  await setStorageItem(STORAGE_KEYS.CUSTOM_WORDS, updated);
  return updated;
}

/**
 * Shaxsiy so'zni o'chirish
 */
export async function deleteCustomWord(wordId) {
  const list = await getCustomWords();
  const updated = list.filter(item => item.id !== wordId);
  await setStorageItem(STORAGE_KEYS.CUSTOM_WORDS, updated);
  return updated;
}

