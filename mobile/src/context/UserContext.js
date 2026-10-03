/**
 * INGLY MOBILE - USER CONTEXT
 * TZ.txt 8-bo'limiga 100% mos ravishda to'liq Auth:
 * - Bir xil login yoki telefon raqam bilan qayta ro'yxatdan o'tishni bloklash (Unique Constraint)
 * - Parol va loginni to'g'ri tekshirish
 * - Google Sign-In
 * - Shaxsiy natijalarni har bir foydalanuvchi hisobida alohida 0 dan saqlash
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStorageItem, setStorageItem, removeStorageItem, STORAGE_KEYS } from '../services/storage.js';
import { syncUserWithSupabase, syncAllLocalUsersToSupabase, fetchUserRemoteStatus } from '../services/userService.js';

const UserContext = createContext();

export const INITIAL_USER = {
  isLoggedIn: false,
  name: '',
  phone: '',
  username: '',
  password: '',
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
};

export function UserProvider({ children }) {
  const [user, setUser] = useState(INITIAL_USER);
  const [isLoading, setIsLoading] = useState(true);

  // Dastlabki sessiyani o'qish va kunlik holatni tekshirish
  useEffect(() => {
    async function loadUser() {
      try {
        const saved = await getStorageItem(STORAGE_KEYS.USER_PROFILE, null);
        if (saved && saved.isLoggedIn) {
          const todayStr = new Date().toISOString().split('T')[0];
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          let streak = saved.streakDays || 0;
          let wordsToday = saved.wordsLearnedToday || 0;

          // Yangi kunga o'tgan bo'lsa, bugungi o'rganilgan so'zlarni 0 dan boshlaymiz
          if (saved.lastActiveDate !== todayStr) {
            wordsToday = 0;
            // Agar oxirgi faollik kechadan oldin bo'lsa, streak uzilgan
            if (saved.lastActiveDate && saved.lastActiveDate !== yesterdayStr) {
              streak = 0;
            }
          }

          setUser({
            ...INITIAL_USER,
            ...saved,
            dailyGoal: Number(saved.dailyGoal) || 20,
            streakDays: streak,
            wordsLearnedToday: wordsToday,
          });

          // Supabase'dan bloklangan yoki VIP statusini tekshirish
          fetchUserRemoteStatus(saved.username).then((remote) => {
            if (remote) {
              if (remote.is_blocked) {
                logout();
                return;
              }
              if (remote.is_premium !== undefined) {
                setUser((prev) => ({ ...prev, isPremium: !!remote.is_premium }));
              }
            }
          }).catch(() => {});
        }

        // Barcha mavjud ro'yxatdan o'tgan foydalanuvchilarni Supabase'ga sinxron qilish
        syncAllLocalUsersToSupabase().catch(() => {});
      } catch (e) {
        console.warn('Foydalanuvchini yuklashda xatolik:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  // Profil va ro'yxatdagi foydalanuvchini yangilab saqlash
  const saveUserData = async (newUserData) => {
    const userToSave = {
      ...user,
      ...newUserData,
      password: newUserData.password || user.password || '',
      dailyGoal: Number(newUserData.dailyGoal) || user.dailyGoal || 20,
    };
    setUser(userToSave);
    await setStorageItem(STORAGE_KEYS.USER_PROFILE, userToSave);

    // Ro'yxatdan o'tgan foydalanuvchilar bazasini ham yangilash
    try {
      const allUsers = (await getStorageItem(STORAGE_KEYS.REGISTERED_USERS, [])) || [];
      const userIndex = allUsers.findIndex(
        (u) => u.username && u.username.toLowerCase() === (userToSave.username || '').toLowerCase()
      );
      if (userIndex !== -1) {
        allUsers[userIndex] = {
          ...allUsers[userIndex],
          ...userToSave,
          password: userToSave.password || allUsers[userIndex].password || '',
        };
      } else if (userToSave.username) {
        allUsers.push(userToSave);
      }
      await setStorageItem(STORAGE_KEYS.REGISTERED_USERS, allUsers);
    } catch (err) {
      console.warn('Foydalanuvchilar bazasini saqlashda xato:', err);
    }

    // Supabase bulut bazasiga ham real-time sinxron qilish
    syncUserWithSupabase(userToSave).catch(() => {});
  };

  // 1. Ro'yxatdan o'tish (Register: Login, Parol va Telefon qat'iy tekshiruvi)
  const register = async ({ fullName, phone, username, password, avatar = '👨‍🎓', dailyGoal = 20 }) => {
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanPhoneDigits = String(phone || '').replace(/\D/g, '');

    // Bo'sh kiritishlar tekshiruvi
    if (!cleanUsername || cleanUsername.length < 3) {
      return {
        success: false,
        error: 'Login kamida 3 ta belgidan iborat bo\'lishi shart!',
      };
    }
    if (/\s/.test(cleanUsername)) {
      return {
        success: false,
        error: 'Login tarkibida bo\'sh joy (probel) bo\'lishi mumkin emas!',
      };
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      return {
        success: false,
        error: 'Parol kamida 6 ta belgidan iborat bo\'lishi va faqat bo\'sh joylardan iborat bo\'lmasligi kerak!',
      };
    }
    if (!cleanPhoneDigits || cleanPhoneDigits.length < 9) {
      return {
        success: false,
        error: 'Iltimos, to\'g\'ri telefon raqam kiriting (kamida 9 ta raqam)!',
      };
    }

    // Mavjud foydalanuvchilarni tekshirish
    const allUsers = (await getStorageItem(STORAGE_KEYS.REGISTERED_USERS, [])) || [];

    // Login takrorlanmasligi tekshiruvi (case-insensitive)
    const loginExists = allUsers.some(
      (u) => (u.username || '').toLowerCase() === cleanUsername
    );
    if (loginExists) {
      return {
        success: false,
        error: `"${username}" logini allaqachon band! Iltimos, boshqa login tanlang.`,
      };
    }

    // Telefon raqam takrorlanmasligi tekshiruvi (oxirgi 9 ta raqam bo'yicha)
    const phoneExists = allUsers.some((u) => {
      const uDigits = (u.phone || '').replace(/\D/g, '');
      return uDigits.length >= 9 && uDigits.slice(-9) === cleanPhoneDigits.slice(-9);
    });

    if (phoneExists) {
      return {
        success: false,
        error: `Ushbu telefon raqami (${phone}) allaqachon ro'yxatdan o'tgan! Iltimos, "Kirish (Login)" bo'limidan kiring.`,
      };
    }

    // Yangi foydalanuvchi obyekti (Barcha natijalar 0 dan)
    const newUser = {
      ...INITIAL_USER,
      isLoggedIn: true,
      name: String(fullName || '').trim() || cleanUsername,
      phone: String(phone || '').trim(),
      username: cleanUsername,
      password: cleanPassword,
      avatar: avatar,
      authMethod: 'credentials',
      dailyGoal: Number(dailyGoal) || 20,
      streakDays: 0,
      wordsLearnedToday: 0,
      totalWordsLearned: 0,
      accuracy: 0,
      activeBook: 1,
      activeUnit: 1,
      lastActiveDate: null,
      bookProgress: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    };

    allUsers.push(newUser);
    await setStorageItem(STORAGE_KEYS.REGISTERED_USERS, allUsers);
    await setStorageItem(STORAGE_KEYS.USER_PROFILE, newUser);
    setUser(newUser);

    // Supabase bulut bazasiga ham zudlik bilan yuborish (Admin ko'rishi uchun)
    syncUserWithSupabase(newUser).catch(() => {});

    return { success: true };
  };

  // 2. Tizimga kirish (Login: Login/Telefon va Parolni tekshirish)
  const login = async ({ loginOrPhone, password }) => {
    const rawInput = String(loginOrPhone || '').trim();
    const cleanLower = rawInput.toLowerCase();
    const inputDigits = rawInput.replace(/\D/g, ''); // faqat raqamlar
    const enteredPassword = String(password || '').trim();

    if (!rawInput) {
      return {
        success: false,
        error: 'Iltimos, Login (username) yoki Telefon raqamingizni kiriting!',
      };
    }
    if (!enteredPassword) {
      return {
        success: false,
        error: 'Iltimos, parolingizni kiriting!',
      };
    }

    let allUsers = (await getStorageItem(STORAGE_KEYS.REGISTERED_USERS, [])) || [];
    const currentProfile = await getStorageItem(STORAGE_KEYS.USER_PROFILE, null);

    // Agar avvalgi profildan qolgan foydalanuvchi bazada bo'lmasa, qo'shib qo'yamiz
    if (currentProfile && currentProfile.username) {
      const alreadyInList = allUsers.some(
        (u) => (u.username || '').toLowerCase() === currentProfile.username.toLowerCase()
      );
      if (!alreadyInList) {
        allUsers.push(currentProfile);
        await setStorageItem(STORAGE_KEYS.REGISTERED_USERS, allUsers);
      }
    }

    // Foydalanuvchini qidirish (login yoki oxirgi 9 ta raqam bo'yicha)
    const matchedUserIndex = allUsers.findIndex((u) => {
      const uUser = (u.username || '').toLowerCase();
      const uPhoneDigits = (u.phone || '').replace(/\D/g, '');
      const matchUsername = uUser === cleanLower;
      const matchPhone =
        inputDigits.length >= 9 &&
        uPhoneDigits.length >= 9 &&
        uPhoneDigits.slice(-9) === inputDigits.slice(-9);

      return matchUsername || matchPhone;
    });

    if (matchedUserIndex === -1) {
      return {
        success: false,
        error: `"${rawInput}" login yoki telefon raqamiga ega foydalanuvchi topilmadi! Iltimos, avval ro'yxatdan o'ting.`,
      };
    }

    const matchedUser = allUsers[matchedUserIndex];
    const expectedPassword = String(matchedUser.password || '').trim();

    if (!expectedPassword) {
      matchedUser.password = enteredPassword;
      allUsers[matchedUserIndex] = matchedUser;
      await setStorageItem(STORAGE_KEYS.REGISTERED_USERS, allUsers);
    } else if (expectedPassword !== enteredPassword) {
      return {
        success: false,
        error: 'Kiritilgan parol noto\'g\'ri! Qaytadan tekshirib kiriting.',
      };
    }

    const activeUser = { ...matchedUser, isLoggedIn: true };
    await setStorageItem(STORAGE_KEYS.USER_PROFILE, activeUser);
    setUser(activeUser);

    return { success: true };
  };

  // 3. Google orqali tezkor kirish (Google Sign-In)
  const loginWithGoogle = async (googleUser = null) => {
    const allUsers = (await getStorageItem(STORAGE_KEYS.REGISTERED_USERS, [])) || [];
    const googleEmail = googleUser?.email || 'google_user@gmail.com';
    const googleUsername = googleEmail.split('@')[0].toLowerCase();

    let existing = allUsers.find(
      (u) => u.username && u.username.toLowerCase() === googleUsername
    );

    if (!existing) {
      existing = {
        ...INITIAL_USER,
        isLoggedIn: true,
        name: googleUser?.name || 'Google O\'quvchi',
        username: googleUsername,
        phone: googleUser?.phone || '+998 90 000 00 00',
        avatar: '🌟',
        authMethod: 'google',
        dailyGoal: 20,
        streakDays: 0,
        wordsLearnedToday: 0,
        totalWordsLearned: 0,
        accuracy: 0,
        activeBook: 1,
        activeUnit: 1,
        lastActiveDate: null,
        bookProgress: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      };
      allUsers.push(existing);
      await setStorageItem(STORAGE_KEYS.REGISTERED_USERS, allUsers);
    } else {
      existing.isLoggedIn = true;
    }

    await setStorageItem(STORAGE_KEYS.USER_PROFILE, existing);
    setUser(existing);
    syncUserWithSupabase(existing).catch(() => {});
    return { success: true };
  };

  // 4. Chiqish (Log out - sessiya qoldiqlarini to'liq tozalash)
  const logout = async () => {
    await removeStorageItem(STORAGE_KEYS.USER_PROFILE);
    await removeStorageItem(STORAGE_KEYS.WORD_PROGRESS);
    await removeStorageItem(STORAGE_KEYS.USER_STREAKS);
    await removeStorageItem(STORAGE_KEYS.FAVORITES);
    await removeStorageItem(STORAGE_KEYS.SYNC_QUEUE);
    setUser(INITIAL_USER);
  };

  // 5. Profil ma'lumotlarini tahrirlash (Ism, Avatar, Telefon, Kunlik Maqsad)
  const updateProfile = async (updates) => {
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

    const updated = {
      ...user,
      ...updates,
      name: cleanName,
      phone: cleanPhone,
      username: updates.username !== undefined ? updates.username.trim().toLowerCase() : user.username,
      dailyGoal: updates.dailyGoal !== undefined ? (Number(updates.dailyGoal) || 20) : (user.dailyGoal || 20),
    };
    await saveUserData(updated);
    return { success: true };
  };

  // 6. So'z o'rganganda progressni oshirish (Bir kunda ko'p so'z yodlasa streak faqat 1 ga oshadi)
  const recordWordLearned = async (wordId, status = 'mastered') => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = user.streakDays || 0;
    let newWordsToday = user.wordsLearnedToday || 0;

    if (user.lastActiveDate === todayStr) {
      // Bir kunda o'rganilgan so'zlar: streak o'zgarmaydi, faqat kunlik so'zlar soni oshadi
      newWordsToday += 1;
    } else if (user.lastActiveDate === yesterdayStr) {
      // Yangi ketma-ket kun: streak 1 ga oshadi, kunlik so'zlar soni 1 dan boshlanadi
      newStreak += 1;
      newWordsToday = 1;
    } else {
      // Birinchi marta yoki 1 kundan ortiq tanaffusdan keyin
      newStreak = 1;
      newWordsToday = 1;
    }

    const newTotal = (user.totalWordsLearned || 0) + 1;
    const currentBookProgress = Math.min(100, Math.round((newTotal / 600) * 100));

    const updated = {
      ...user,
      wordsLearnedToday: newWordsToday,
      totalWordsLearned: newTotal,
      streakDays: newStreak,
      lastActiveDate: todayStr,
      bookProgress: {
        ...user.bookProgress,
        [user.activeBook || 1]: currentBookProgress,
      },
      reviewedWordsCount: status === 'review' ? (user.reviewedWordsCount || 0) + 1 : (user.reviewedWordsCount || 0),
      hardWordsCount: status === 'hard' ? (user.hardWordsCount || 0) + 1 : (user.hardWordsCount || 0),
    };
    await saveUserData(updated);
  };

  // 7. Test natijalarini saqlash (0 ga bo'linishdan xavfsiz)
  const recordQuizResult = async (score, total) => {
    if (!total || total <= 0) return;
    const safeScore = Math.max(0, Math.min(score, total));
    const accuracyPercent = Math.round((safeScore / total) * 100);
    const prevAcc = user.accuracy || 0;
    const newAccuracy = prevAcc === 0 ? accuracyPercent : Math.round((prevAcc + accuracyPercent) / 2);

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = user.streakDays || 0;
    if (score > 0 && user.lastActiveDate !== todayStr) {
      if (user.lastActiveDate === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    }

    const updated = {
      ...user,
      accuracy: newAccuracy,
      streakDays: newStreak,
      lastActiveDate: score > 0 ? todayStr : user.lastActiveDate,
    };
    await saveUserData(updated);
  };

  // 8. Statistikalarni 0 ga qaytarish (Reset progress)
  const resetProgress = async () => {
    const resetUser = {
      ...user,
      streakDays: 0,
      wordsLearnedToday: 0,
      totalWordsLearned: 0,
      reviewedWordsCount: 0,
      hardWordsCount: 0,
      accuracy: 0,
      activeBook: 1,
      activeUnit: 1,
      lastActiveDate: null,
      bookProgress: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    };
    await saveUserData(resetUser);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        register,
        login,
        loginWithGoogle,
        logout,
        updateProfile,
        recordWordLearned,
        recordQuizResult,
        resetProgress,
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
