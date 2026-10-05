/**
 * INGLY MOBILE - LEADERBOARD & LEVELING SERVICE
 * 
 * Foydalanuvchilar o'rtasida reyting (leaderboard) va darajalar (levels) tizimi:
 * 1. O'qishiga qarab darajasi (Level) doimiy oshib borishi
 * 2. Kitobdan yodlangan so'zlar + Shaxsiy lug'atdagi so'zlar hisobi
 * 3. Supabase bulut bazasi bilan real-time sinxronizatsiya
 * 4. Barcha ro'yxatdan o'tgan foydalanuvchilarni saralash (Rank #1, #2...)
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from './storage.js';

const SUPABASE_REST_URL = 'https://lbsqxownrjfmjoojdsfk.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_Kbpya9vZpqll4KuUXQrpHQ_Tq3qcZ1W';
const STORAGE_KEY_LEADERBOARD = 'ingly_cached_leaderboard';

/**
 * 12 ta Gamified Daraja (Levels) konfiguratsiyasi
 */
export const LEVELS_CONFIG = [
  { level: 1, minWords: 0, titleUz: "Boshlang'ich", titleRu: "Новичок", titleEn: "Beginner", icon: "🌱", color: "#10B981" },
  { level: 2, minWords: 30, titleUz: "Izlanuvchi", titleRu: "Искатель", titleEn: "Explorer", icon: "🔍", color: "#06B6D4" },
  { level: 3, minWords: 70, titleUz: "O'rganuvchi", titleRu: "Ученик", titleEn: "Learner", icon: "📚", color: "#3B82F6" },
  { level: 4, minWords: 130, titleUz: "Faol Talaba", titleRu: "Студент", titleEn: "Scholar", icon: "⚡", color: "#6366F1" },
  { level: 5, minWords: 210, titleUz: "Bilimdon", titleRu: "Знаток", titleEn: "Master Mind", icon: "🧠", color: "#8B5CF6" },
  { level: 6, minWords: 320, titleUz: "So'z Ustasi", titleRu: "Мастер Слов", titleEn: "Word Master", icon: "🎖️", color: "#EC4899" },
  { level: 7, minWords: 460, titleUz: "Poliglot", titleRu: "Полиглот", titleEn: "Polyglot", icon: "🏆", color: "#F59E0B" },
  { level: 8, minWords: 650, titleUz: "Ekspert", titleRu: "Эксперт", titleEn: "Expert", icon: "💎", color: "#38BDF8" },
  { level: 9, minWords: 900, titleUz: "Professional", titleRu: "Профи", titleEn: "Pro", icon: "🌟", color: "#A855F7" },
  { level: 10, minWords: 1250, titleUz: "Leksik Daho", titleRu: "Лексический Гений", titleEn: "Lexical Genius", icon: "👑", color: "#EAB308" },
  { level: 11, minWords: 1700, titleUz: "Chempion", titleRu: "Чемпион", titleEn: "Champion", icon: "🔥", color: "#EF4444" },
  { level: 12, minWords: 2300, titleUz: "Afsona", titleRu: "Легенда", titleEn: "Legend", icon: "🚀", color: "#5B4DFF" },
];

/**
 * Foydalanuvchining jami so'zlariga qarab hozirgi darajasi (Level) va
 * keyingi darajagacha bo'lgan foizni hisoblash
 */
export function getUserLevelInfo(totalWords = 0) {
  const words = Math.max(0, Number(totalWords) || 0);

  let currentLevelObj = LEVELS_CONFIG[0];
  let nextLevelObj = LEVELS_CONFIG[1];

  for (let i = LEVELS_CONFIG.length - 1; i >= 0; i--) {
    if (words >= LEVELS_CONFIG[i].minWords) {
      currentLevelObj = LEVELS_CONFIG[i];
      nextLevelObj = LEVELS_CONFIG[i + 1] || null;
      break;
    }
  }

  const currentMin = currentLevelObj.minWords;
  const nextMin = nextLevelObj ? nextLevelObj.minWords : currentMin + 500;
  const range = nextMin - currentMin;
  const gained = words - currentMin;
  const progressPercent = Math.min(100, Math.max(5, Math.round((gained / range) * 100)));
  const wordsToNext = Math.max(0, nextMin - words);

  return {
    level: currentLevelObj.level,
    titleUz: currentLevelObj.titleUz,
    titleRu: currentLevelObj.titleRu,
    titleEn: currentLevelObj.titleEn,
    icon: currentLevelObj.icon,
    color: currentLevelObj.color,
    currentWords: words,
    nextLevelWords: nextMin,
    wordsToNext: wordsToNext,
    progressPercent: progressPercent,
    isMaxLevel: !nextLevelObj,
  };
}

/**
 * XP (Tajriba Ballari) hisoblash:
 * - Har bir so'z = 10 XP
 * - Har bir kunlik streak = 25 XP
 * - Test aniqligi = accuracy * 5 XP
 */
export function calculateUserXP(wordsCount = 0, streakDays = 0, accuracy = 0) {
  return (
    (Number(wordsCount) || 0) * 10 +
    (Number(streakDays) || 0) * 25 +
    Math.round((Number(accuracy) || 0) * 5)
  );
}

/**
 * Foydalanuvchining eng so'nggi natijalarini Supabase `app_settings` dagi
 * `leaderboard_scores` kalitiga sinxronlashtirish
 */
export async function syncUserLeaderboardScore(currentUser) {
  if (!currentUser || !currentUser.username) return;

  try {
    const cleanUsername = String(currentUser.username).toLowerCase().replace(/^@/, '').trim();
    const fullName = String(currentUser.name || currentUser.fullName || cleanUsername).trim();
    const bookWords = Number(currentUser.totalWordsLearned) || 0;
    
    // Shaxsiy lug'atdagi so'zlarni ham hisobga olish
    const customWords = (await getStorageItem(STORAGE_KEYS.CUSTOM_WORDS, [])) || [];
    const customLearned = customWords.filter(w => w.learned).length;
    const totalWords = bookWords + customLearned;

    const streak = Number(currentUser.streakDays) || 0;
    const accuracy = Number(currentUser.accuracy) || 0;
    const xp = calculateUserXP(totalWords, streak, accuracy);
    const levelInfo = getUserLevelInfo(totalWords);

    const userEntry = {
      username: cleanUsername,
      name: fullName,
      avatar: currentUser.avatar || '👨‍🎓',
      bookWords: bookWords,
      customWords: customLearned,
      totalWords: totalWords,
      streak: streak,
      accuracy: accuracy,
      xp: xp,
      level: levelInfo.level,
      levelTitle: levelInfo.titleUz,
      levelIcon: levelInfo.icon,
      isPremium: !!currentUser.isPremium,
      updatedAt: new Date().toISOString(),
    };

    // 1. Keshdagi leaderboardni yangilash
    let localBoard = (await getStorageItem(STORAGE_KEY_LEADERBOARD, [])) || [];
    const idx = localBoard.findIndex(u => String(u.username).toLowerCase() === cleanUsername);
    if (idx !== -1) {
      localBoard[idx] = { ...localBoard[idx], ...userEntry };
    } else {
      localBoard.push(userEntry);
    }
    await setStorageItem(STORAGE_KEY_LEADERBOARD, localBoard);

    // 2. Supabase orqali bulutga saqlash
    if (isSupabaseConfigured() && supabase) {
      const { data: existingSetting } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'leaderboard_scores')
        .limit(1);

      let scoresMap = {};
      if (existingSetting && existingSetting.length > 0) {
        const val = existingSetting[0].setting_value;
        if (typeof val === 'object' && val !== null) {
          scoresMap = val;
        } else if (typeof val === 'string' && val.startsWith('{')) {
          try { scoresMap = JSON.parse(val); } catch (e) {}
        }
      }

      scoresMap[cleanUsername] = userEntry;

      await supabase.from('app_settings').upsert({
        setting_key: 'leaderboard_scores',
        setting_value: scoresMap,
        description: 'Barcha foydalanuvchilarning real-time reyting va so\'z yodlash statistikasi'
      }, { onConflict: 'setting_key' });
    }
  } catch (err) {
    console.warn('[Leaderboard] syncUserLeaderboardScore xatosi:', err?.message || err);
  }
}

/**
 * Barcha foydalanuvchilarning reyting jadvalini olish:
 * - Supabase `users` jadvalidagi foydalanuvchilar
 * - `app_settings.leaderboard_scores` dagi real natijalar
 * - Hozirgi kirgan foydalanuvchining eng so'nggi natijalari
 * Natija: 1-o'rindan oxirigacha saralangan massiv
 */
export async function fetchLeaderboard(currentUser = null) {
  let combinedUsersMap = new Map();

  // 1. Keshdagi ma'lumotlarni o'qish
  try {
    const cached = await getStorageItem(STORAGE_KEY_LEADERBOARD, []);
    if (Array.isArray(cached)) {
      cached.forEach(u => {
        if (u && u.username) combinedUsersMap.set(String(u.username).toLowerCase(), u);
      });
    }
  } catch (e) {}

  // 2. Supabase bulut bazasidan real foydalanuvchilar va ularning ballarini yuklash
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    };

    // A. Barcha ro'yxatdan o'tgan foydalanuvchilarni olish
    const usersRes = await fetch(`${SUPABASE_REST_URL}/users?select=id,full_name,username,phone,is_premium,created_at`, { headers });
    let dbUsers = [];
    if (usersRes.ok) {
      dbUsers = await usersRes.json();
    }

    // B. Leaderboard ballarini olish
    const scoresRes = await fetch(`${SUPABASE_REST_URL}/app_settings?setting_key=eq.leaderboard_scores&select=setting_value`, { headers });
    let scoresMap = {};
    if (scoresRes.ok) {
      const scoresData = await scoresRes.json();
      if (scoresData && scoresData.length > 0) {
        const val = scoresData[0].setting_value;
        if (typeof val === 'object' && val !== null) {
          scoresMap = val;
        } else if (typeof val === 'string' && val.startsWith('{')) {
          try { scoresMap = JSON.parse(val); } catch (e) {}
        }
      }
    }

    // Har bir Supabase foydalanuvchisini birlashtirish
    if (Array.isArray(dbUsers)) {
      dbUsers.forEach(u => {
        const uName = String(u.username || '').toLowerCase().trim();
        if (!uName) return;

        const scoreEntry = scoresMap[uName] || {};
        const totalWords = Number(scoreEntry.totalWords || scoreEntry.wordsLearned || 0);
        const streak = Number(scoreEntry.streak || 0);
        const accuracy = Number(scoreEntry.accuracy || 0);
        const xp = Number(scoreEntry.xp) || calculateUserXP(totalWords, streak, accuracy);
        const levelInfo = getUserLevelInfo(totalWords);

        combinedUsersMap.set(uName, {
          username: uName,
          name: u.full_name || scoreEntry.name || uName,
          avatar: scoreEntry.avatar || (u.is_premium ? '👑' : '👨‍🎓'),
          bookWords: Number(scoreEntry.bookWords || totalWords),
          customWords: Number(scoreEntry.customWords || 0),
          totalWords: totalWords,
          streak: streak,
          accuracy: accuracy,
          xp: xp,
          level: levelInfo.level,
          levelTitle: levelInfo.titleUz,
          levelIcon: levelInfo.icon,
          isPremium: !!u.is_premium || !!scoreEntry.isPremium,
          updatedAt: scoreEntry.updatedAt || u.created_at,
        });
      });
    }
  } catch (err) {
    console.warn('[Leaderboard] Remote fetch xatosi:', err?.message || err);
  }

  // 3. Hozirgi kirgan foydalanuvchi ma'lumotlarini eng yangi holatda kiritish
  if (currentUser && currentUser.username) {
    const curUname = String(currentUser.username).toLowerCase().replace(/^@/, '').trim();
    const curBookWords = Number(currentUser.totalWordsLearned) || 0;
    
    let curCustomLearned = 0;
    try {
      const customWords = (await getStorageItem(STORAGE_KEYS.CUSTOM_WORDS, [])) || [];
      curCustomLearned = customWords.filter(w => w.learned).length;
    } catch (e) {}

    const curTotalWords = curBookWords + curCustomLearned;
    const curStreak = Number(currentUser.streakDays) || 0;
    const curAccuracy = Number(currentUser.accuracy) || 0;
    const curXp = calculateUserXP(curTotalWords, curStreak, curAccuracy);
    const curLevelInfo = getUserLevelInfo(curTotalWords);

    combinedUsersMap.set(curUname, {
      username: curUname,
      name: String(currentUser.name || currentUser.fullName || curUname).trim(),
      avatar: currentUser.avatar || '👨‍🎓',
      bookWords: curBookWords,
      customWords: curCustomLearned,
      totalWords: curTotalWords,
      streak: curStreak,
      accuracy: curAccuracy,
      xp: curXp,
      level: curLevelInfo.level,
      levelTitle: curLevelInfo.titleUz,
      levelIcon: curLevelInfo.icon,
      isPremium: !!currentUser.isPremium,
      isCurrent: true,
      updatedAt: new Date().toISOString(),
    });
  }

  // Massivga o'girish va saralash:
  // 1-o'rinda: eng ko'p jami so'z yodlaganlar (yoki teng bo'lsa XP va Streak bo'yicha)
  let list = Array.from(combinedUsersMap.values());

  // Agar bazada foydalanuvchilar juda kam bo'lsa, platformani jonli va qiziqarli ko'rsatish uchun
  // namuna sifatida realistik faol talabalar (demo peers) bilan to'ldiramiz
  if (list.length < 5) {
    const demoPeers = [
      { username: 'shohruh_ielts', name: 'Shohruh Mirzayev', avatar: '🦁', bookWords: 180, customWords: 24, totalWords: 204, streak: 8, accuracy: 94, isPremium: true },
      { username: 'madina_eng', name: 'Madina Karimova', avatar: '👩‍🎓', bookWords: 140, customWords: 15, totalWords: 155, streak: 6, accuracy: 91, isPremium: false },
      { username: 'jasur_dev', name: 'Jasurbek Oripov', avatar: '🚀', bookWords: 95, customWords: 12, totalWords: 107, streak: 4, accuracy: 88, isPremium: false },
      { username: 'laylo_student', name: 'Laylo Alimova', avatar: '🌸', bookWords: 60, customWords: 8, totalWords: 68, streak: 3, accuracy: 85, isPremium: false },
    ];

    demoPeers.forEach(peer => {
      if (!combinedUsersMap.has(peer.username)) {
        const lvl = getUserLevelInfo(peer.totalWords);
        list.push({
          ...peer,
          xp: calculateUserXP(peer.totalWords, peer.streak, peer.accuracy),
          level: lvl.level,
          levelTitle: lvl.titleUz,
          levelIcon: lvl.icon,
          updatedAt: new Date().toISOString(),
        });
      }
    });
  }

  // Saralash: totalWords (kamayish tartibida), so'ng XP, so'ng streak
  list.sort((a, b) => {
    if (b.totalWords !== a.totalWords) {
      return b.totalWords - a.totalWords;
    }
    if (b.xp !== a.xp) {
      return b.xp - a.xp;
    }
    return (b.streak || 0) - (a.streak || 0);
  });

  // O'rinlarni belgilash (#1, #2...)
  const rankedList = list.map((item, index) => {
    const rank = index + 1;
    let medal = '';
    if (rank === 1) medal = '🥇';
    else if (rank === 2) medal = '🥈';
    else if (rank === 3) medal = '🥉';

    return {
      ...item,
      rank,
      medal,
    };
  });

  // Keshga saqlash
  setStorageItem(STORAGE_KEY_LEADERBOARD, rankedList).catch(() => {});

  return rankedList;
}
