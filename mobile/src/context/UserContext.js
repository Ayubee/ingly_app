/**
 * INGLY MOBILE - USER CONTEXT
 * TZ.txt 8-bo'limiga 100% mos ravishda to'liq Auth:
 * - Bir xil login yoki telefon raqam bilan qayta ro'yxatdan o'tishni bloklash (Unique Constraint)
 * - Parol va loginni to'g'ri tekshirish
 * - Google Sign-In
 * - Shaxsiy natijalarni har bir foydalanuvchi hisobida alohida 0 dan saqlash
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { getStorageItem, setStorageItem, removeStorageItem, STORAGE_KEYS } from '../services/storage.js';
import { syncUserWithSupabase, syncAllLocalUsersToSupabase, fetchUserRemoteStatus, verifyUserCredentialsRemote } from '../services/userService.js';
import { recordTransaction } from '../services/appSettingsService.js';
import { syncUserLeaderboardScore } from '../services/leaderboardService.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';

const UserContext = createContext();

export const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000; // 180 kun (~6 oy)

/**
 * Parol oxirgi marta o'rnatilganidan buyon 6 oy (180 kun) o'tganligini tekshirish.
 * TALAB: Ilovaga kirishi bilanoq xabar chiqmasin! Ro'yxatdan o'tgan yoki oxirgi o'zgartirilgan kundan 6 oy (180 kun) o'tgachgina chiqadi.
 */
export const isPasswordOlderThan6Months = (user) => {
  if (!user || !user.isLoggedIn) return false;
  // Google orqali kirgan va paroli yo'q bo'lsa, eslatma kerak emas
  if (user.authMethod === 'google' && !user.password_hash && !user.password) return false;

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
  password_hash: '',
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

          const userCreatedAt = saved.createdAt || saved.created_at || new Date().toISOString();
          const userPassChanged = saved.passwordChangedAt || saved.password_changed_at || userCreatedAt;

          const userIsPrem = !!saved.isPremium;
          const userPurchased = Array.isArray(saved.purchasedBooks) ? saved.purchasedBooks : [];
          const effectiveUnlocked = userIsPrem
            ? [1, 2, 3, 4, 5, 6]
            : [1, ...userPurchased.filter((b) => b > 1)];

          setUser({
            ...INITIAL_USER,
            ...saved,
            createdAt: userCreatedAt,
            passwordChangedAt: userPassChanged,
            isPremium: userIsPrem,
            premiumUntil: saved.premiumUntil || null,
            unlockedBooks: effectiveUnlocked,
            purchasedBooks: userPurchased,
            dailyGoal: Number(saved.dailyGoal) || 20,
            streakDays: streak,
            wordsLearnedToday: wordsToday,
          });

          // Supabase'dan bloklangan yoki VIP statusini tekshirish
          try {
            const remote = await fetchUserRemoteStatus(saved.username);
            if (remote) {
              if (remote.is_blocked) {
                await logout();
                Alert.alert(
                  'Hisobingiz Bloklangan 🚫',
                  'Administrator sizning profilingizni bloklagan. Ilovaga kirish taqiqlanadi.'
                );
                return;
              }
              if (remote.is_premium !== undefined) {
                const isPrem = !!remote.is_premium;
                setUser((prev) => {
                  const purchased = Array.isArray(prev.purchasedBooks) ? prev.purchasedBooks : [];
                  return {
                    ...prev,
                    isPremium: isPrem,
                    premiumUntil: isPrem ? (remote.premium_until || prev.premiumUntil) : null,
                    unlockedBooks: isPrem ? [1, 2, 3, 4, 5, 6] : [1, ...purchased.filter((b) => b > 1)],
                  };
                });
              }
            }
          } catch (e) {}
        }

        // Barcha mavjud ro'yxatdan o'tgan foydalanuvchilarni Supabase'ga sinxron qilish
        syncAllLocalUsersToSupabase().catch(() => {});
      } catch (e) {
        console.warn('Foydalanuvchini yuklashda xatolik:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();

    // Har 10 soniyada admin tomonidan bloklanganlik yoki VIP statusini tekshirish
    const intervalId = setInterval(async () => {
      const active = await getStorageItem(STORAGE_KEYS.USER_PROFILE, null);
      if (active && active.isLoggedIn && active.username) {
        try {
          const remote = await fetchUserRemoteStatus(active.username);
          if (remote) {
            if (remote.is_blocked) {
              await logout();
              Alert.alert(
                'Hisobingiz Bloklandi 🚫',
                'Administrator sizning profilingizni blokladi. Ilovadan foydalanish to\'xtatildi.'
              );
            } else if (remote.is_premium !== undefined && (remote.is_premium !== active.isPremium || remote.premium_until !== active.premiumUntil)) {
              const isPrem = !!remote.is_premium;
              setUser((prev) => {
                const purchased = Array.isArray(prev.purchasedBooks) ? prev.purchasedBooks : [];
                return {
                  ...prev,
                  isPremium: isPrem,
                  premiumUntil: isPrem ? (remote.premium_until || prev.premiumUntil) : null,
                  unlockedBooks: isPrem ? [1, 2, 3, 4, 5, 6] : [1, ...purchased.filter((b) => b > 1)],
                };
              });
            }
          }
        } catch (e) {}
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // Profil va ro'yxatdagi foydalanuvchini yangilab saqlash (Parol ochiq matnda saqlanmaydi)
  const saveUserData = async (newUserData) => {
    let computedHash = newUserData.password_hash || user.password_hash;
    if (newUserData.password) {
      computedHash = hashPassword(newUserData.password);
    }
    const userToSave = {
      ...user,
      ...newUserData,
      password_hash: computedHash,
      dailyGoal: Number(newUserData.dailyGoal) || user.dailyGoal || 20,
    };
    delete userToSave.password; // Ochiq matndagi parol tozalab tashlanadi

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
          password_hash: computedHash,
        };
        delete allUsers[userIndex].password;
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

    const nowIso = new Date().toISOString();
    const passwordHash = hashPassword(cleanPassword);

    // Yangi foydalanuvchi obyekti (Parol faqat heshlangan holatda saqlanadi)
    const newUser = {
      ...INITIAL_USER,
      isLoggedIn: true,
      name: String(fullName || '').trim() || cleanUsername,
      phone: String(phone || '').trim(),
      username: cleanUsername,
      password_hash: passwordHash,
      passwordChangedAt: nowIso,
      createdAt: nowIso,
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

  // 2. Tizimga kirish (Login: Kriptografik tekshiruv)
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

    // 1. Supabase bulut bazasidan foydalanuvchining bloklanganligini tekshirish
    const remote = await fetchUserRemoteStatus(rawInput);
    if (remote && remote.is_blocked) {
      return {
        success: false,
        error: 'Sizning hisobingiz administrator tomonidan BLOKLANGAN! Ilovaga kirish taqiqlanadi.',
      };
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

    let userIdx = matchedUserIndex;
    let matchedUser = userIdx !== -1 ? allUsers[userIdx] : null;

    // Parolni tekshirish (Lokal va Bulutdagi yangilangan parol tekshiruvi)
    let isPasswordValid = false;
    const targetHash = remote?.password_hash || matchedUser?.password_hash || matchedUser?.password;
    if (targetHash) {
      isPasswordValid = verifyPassword(enteredPassword, targetHash);
      if (isPasswordValid && matchedUser && remote?.password_hash) {
        matchedUser.password_hash = remote.password_hash;
        delete matchedUser.password;
      }
    }

    // Agar lokal topilmasa yoki mos kelmasa, Supabase orqali tekshirish
    if (!isPasswordValid) {
      const enteredHash = hashPassword(enteredPassword);
      const remoteCheck = await verifyUserCredentialsRemote(rawInput, enteredHash);
      if (remoteCheck && remoteCheck.success && remoteCheck.user) {
        isPasswordValid = true;
        const rUser = remoteCheck.user;
        if (!matchedUser) {
          matchedUser = {
            ...INITIAL_USER,
            id: rUser.id,
            name: rUser.full_name || rUser.username || rawInput,
            username: rUser.username || cleanLower,
            phone: rUser.phone || '',
            password_hash: enteredHash,
            isPremium: !!rUser.is_premium,
            isBlocked: !!rUser.is_blocked,
          };
          allUsers.push(matchedUser);
          userIdx = allUsers.length - 1;
        } else {
          matchedUser.password_hash = enteredHash;
          delete matchedUser.password;
          allUsers[userIdx] = matchedUser;
        }
      }
    }

    if (!matchedUser) {
      return {
        success: false,
        error: `"${rawInput}" login yoki telefon raqamiga ega foydalanuvchi topilmadi! Iltimos, avval ro'yxatdan o'ting.`,
      };
    }

    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Kiritilgan parol noto\'g\'ri! Qaytadan tekshirib kiriting.',
      };
    }

    // Parolni yangi xavfsiz heshga yangilash va ochiq matnni tozalash
    matchedUser.password_hash = hashPassword(enteredPassword);
    delete matchedUser.password;

    if (remote && remote.is_premium !== undefined) {
      matchedUser.isPremium = !!remote.is_premium;
      if (remote.premium_until) {
        matchedUser.premiumUntil = remote.premium_until;
      }
    } else {
      matchedUser.isPremium = !!matchedUser.isPremium;
    }

    const userPurchased = Array.isArray(matchedUser.purchasedBooks) ? matchedUser.purchasedBooks : [];
    matchedUser.purchasedBooks = userPurchased;
    matchedUser.unlockedBooks = matchedUser.isPremium
      ? [1, 2, 3, 4, 5, 6]
      : [1, ...userPurchased.filter((b) => b > 1)];

    const userCreatedAt = matchedUser.createdAt || matchedUser.created_at || remote?.created_at || new Date().toISOString();
    const userPassChanged = matchedUser.passwordChangedAt || matchedUser.password_changed_at || userCreatedAt;

    matchedUser.createdAt = userCreatedAt;
    matchedUser.passwordChangedAt = userPassChanged;
    allUsers[userIdx] = matchedUser;
    await setStorageItem(STORAGE_KEYS.REGISTERED_USERS, allUsers);

    const activeUser = {
      ...matchedUser,
      isLoggedIn: true,
      createdAt: userCreatedAt,
      passwordChangedAt: userPassChanged,
    };
    await setStorageItem(STORAGE_KEYS.USER_PROFILE, activeUser);
    setUser(activeUser);

    return { success: true };
  };

  // 3. Google orqali tezkor kirish (Google Sign-In)
  const loginWithGoogle = async (googleUser = null) => {
    const allUsers = (await getStorageItem(STORAGE_KEYS.REGISTERED_USERS, [])) || [];
    const googleEmail = googleUser?.email || 'google_user@gmail.com';
    const googleUsername = googleEmail.split('@')[0].toLowerCase();

    // Bloklanganlikni tekshirish
    const remote = await fetchUserRemoteStatus(googleUsername);
    if (remote && remote.is_blocked) {
      Alert.alert(
        'Hisob Bloklangan 🚫',
        'Sizning hisobingiz administrator tomonidan bloklangan! Ilovaga kirish taqiqlanadi.'
      );
      return;
    }

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
        isPremium: !!remote?.is_premium,
        premiumUntil: remote?.premium_until || null,
        unlockedBooks: remote?.is_premium ? [1, 2, 3, 4, 5, 6] : [1],
        purchasedBooks: [],
      };
      allUsers.push(existing);
      await setStorageItem(STORAGE_KEYS.REGISTERED_USERS, allUsers);
    } else {
      existing.isLoggedIn = true;
      if (remote && remote.is_premium !== undefined) {
        existing.isPremium = !!remote.is_premium;
        existing.premiumUntil = remote.premium_until || null;
      }
      const gPurchased = Array.isArray(existing.purchasedBooks) ? existing.purchasedBooks : [];
      existing.purchasedBooks = gPurchased;
      existing.unlockedBooks = existing.isPremium ? [1, 2, 3, 4, 5, 6] : [1, ...gPurchased.filter((b) => b > 1)];
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

  // 9. Faol kitob va darsni (unit) tanlash
  const setActiveLesson = async (bookNumber, unitNumber) => {
    const book = Math.max(1, Math.min(6, parseInt(bookNumber, 10) || 1));
    const unit = Math.max(1, Math.min(30, parseInt(unitNumber, 10) || 1));
    const updated = {
      ...user,
      activeBook: book,
      activeUnit: unit,
    };
    await saveUserData(updated);
  };

  // 10. Foydalanuvchi parolini o'zgartirish (Faqat eski parolni to'g'ri yozganda yangi parol qo'yish imkoni)
  const changePassword = async ({ oldPassword, newPassword, confirmPassword }) => {
    const cleanOld = String(oldPassword || '').trim();
    const cleanNew = String(newPassword || '').trim();
    const cleanConfirm = String(confirmPassword || '').trim();

    const currentHash = user.password_hash || (user.password ? hashPassword(user.password) : '');

    if (currentHash) {
      if (!cleanOld) {
        return {
          success: false,
          error: 'Iltimos, avval joriy (eski) parolingizni kiriting!',
        };
      }
      if (!verifyPassword(cleanOld, currentHash)) {
        return {
          success: false,
          error: 'Kiritilgan eski parol noto\'g\'ri! Qaytadan tekshirib kiriting.',
        };
      }
    }

    if (!cleanNew) {
      return {
        success: false,
        error: 'Iltimos, yangi parolni kiriting!',
      };
    }

    if (cleanNew.length < 6) {
      return {
        success: false,
        error: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak!',
      };
    }

    if (cleanConfirm && cleanNew !== cleanConfirm) {
      return {
        success: false,
        error: 'Yangi parollar bir-biriga mos kelmadi! Qaytadan tekshiring.',
      };
    }

    if (currentHash && verifyPassword(cleanNew, currentHash)) {
      return {
        success: false,
        error: 'Yangi parol eski parolingiz bilan bir xil bo\'lishi mumkin emas. Yangi parol tanlang!',
      };
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const newHash = hashPassword(cleanNew);

    const updatedUser = {
      ...user,
      password_hash: newHash,
      passwordChangedAt: nowIso,
      lastPasswordReminderDate: todayStr,
    };
    delete updatedUser.password;

    await saveUserData(updatedUser);

    // Supabase bulut bazasiga ham zudlik bilan yangi parolni heshlangan holatda sinxron qilish
    try {
      await syncUserWithSupabase({
        ...updatedUser,
        password_hash: newHash,
      });
    } catch (e) {}

    return { success: true };
  };

  // 11. 6 oylik parol eslatmasini keyinroqqa qoldirish (Bugungi kun uchun bekor qilish)
  const dismissPasswordReminder = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updated = {
      ...user,
      lastPasswordReminderDate: todayStr,
    };
    setUser(updated);
    await setStorageItem(STORAGE_KEYS.USER_PROFILE, updated);
  };

  // 12. VIP Oylik Obunani faollashtirish (Click, Payme yoki Bank Karta to'lovidan so'ng)
  const subscribeVipMonthly = async (paymentDetails = {}) => {
    const now = new Date();
    // 30 kunlik muddat beriladi
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const updated = {
      ...user,
      isPremium: true,
      premiumUntil: expiresAt,
      // VIP bo'lganda barcha 6 ta kitob avtomatik ochiq
      unlockedBooks: [1, 2, 3, 4, 5, 6],
    };

    await saveUserData(updated);

    try {
      await syncUserWithSupabase({
        ...updated,
        is_premium: true,
        premium_until: expiresAt,
      });
    } catch (e) {
      console.warn('VIP obunani Supabase ga saqlashda xato:', e);
    }

    // Admin panel moliya hisobotiga kirim tranzaksiyasini yozish
    try {
      await recordTransaction({
        type: 'income',
        userName: user.name || 'Foydalanuvchi',
        username: user.username || 'user',
        itemTitle: paymentDetails.itemTitle || 'Ingly VIP Oylik Obuna (1 oy)',
        itemType: 'vip',
        amount: paymentDetails.price || paymentDetails.amount || 29000,
        paymentMethod: paymentDetails.method || paymentDetails.paymentMethod || 'Click',
        note: 'Mobil ilovadan oylik VIP obuna xaridi',
      });
    } catch (txErr) {
      console.warn('VIP tranzaksiya yozishda xato:', txErr);
    }

    return { success: true, expiresAt };
  };

  // 13. Bitta kitobni doimiy sotib olish (Click, Payme yoki Bank Karta)
  const purchaseBook = async (bookId, paymentDetails = {}) => {
    const numId = Number(bookId);
    const currentPurchased = Array.isArray(user.purchasedBooks) ? [...user.purchasedBooks] : [];
    if (!currentPurchased.includes(numId)) {
      currentPurchased.push(numId);
    }
    const currentUnlocked = Array.isArray(user.unlockedBooks) ? [...user.unlockedBooks] : [1];
    if (!currentUnlocked.includes(numId)) {
      currentUnlocked.push(numId);
    }

    const updated = {
      ...user,
      unlockedBooks: currentUnlocked,
      purchasedBooks: currentPurchased,
    };

    await saveUserData(updated);

    try {
      await syncUserWithSupabase(updated);
    } catch (e) {}

    // Admin panel moliya hisobotiga kirim tranzaksiyasini yozish
    try {
      await recordTransaction({
        type: 'income',
        userName: user.name || 'Foydalanuvchi',
        username: user.username || 'user',
        itemTitle: paymentDetails.itemTitle || `Book ${numId} (To'liq ochish)`,
        itemType: 'book',
        amount: paymentDetails.price || paymentDetails.amount || 10000,
        paymentMethod: paymentDetails.method || paymentDetails.paymentMethod || 'Click',
        note: `Mobil ilovadan Book ${numId} kitobini xarid qilish`,
      });
    } catch (txErr) {
      console.warn('Kitob tranzaksiya yozishda xato:', txErr);
    }

    return { success: true, bookId: numId };
  };

  // VIP obuna ayni paytda faolmi? (Tugash muddati o'tib ketmaganmi)
  const isVipActive = Boolean(
    user &&
    user.isPremium &&
    (!user.premiumUntil || new Date(user.premiumUntil).getTime() > Date.now())
  );

  // Kitob ochilganmi yoki bepulmi? (Admin tomonidan bepul qilingan kitoblar, VIP yoki xarid qilingan bo'lishi shart)
  const isBookPurchasedOrFree = (bookId, freeBooksCount = 1, premiumModeEnabled = true, freeBookIds = null) => {
    if (!premiumModeEnabled) return true; // Agar admin pullik rejimni o'chirsa, hamma kitob ochiq
    if (isVipActive) return true;          // VIP obunachi uchun barcha kitoblar ochiq
    const num = Number(bookId);
    if (Array.isArray(freeBookIds) && freeBookIds.includes(num)) return true; // Admin alohida tekin qilgan kitob
    if (num <= freeBooksCount) return true; // Bepul kitoblar soni bo'yicha
    if (Array.isArray(user?.unlockedBooks) && user.unlockedBooks.includes(num)) return true; // Ushbu foydalanuvchi sotib olgan kitob
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
