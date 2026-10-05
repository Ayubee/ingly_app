/**
 * INGLY MOBILE - I18N LOCALIZATION SERVICE
 * Qo'llab-quvvatlanadigan tillar:
 * 1. O'zbekcha ('uz') - Asosiy til
 * 2. Русский ('ru')
 * 3. English ('en')
 */

import { getStorageItem, setStorageItem } from './storage.js';

export const SUPPORTED_LANGUAGES = [
  { code: 'uz', name: 'O\'zbekcha', flag: '🇺🇿', native: 'O\'zbekcha' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', native: 'Русский' },
  { code: 'en', name: 'English', flag: '🇬🇧', native: 'English' },
];

export const STORAGE_KEY_LANGUAGE = '@ingly_app_language';

export const translations = {
  uz: {
    // Navigation
    nav_home: "Bosh sahifa",
    nav_learn: "Darslar",
    nav_my_words: "Lug'atim",
    nav_cards: "Kartalar",
    nav_quiz: "Test",
    nav_profile: "Profil",

    // Profile Screen
    profile_title: "Shaxsiy Profil",
    profile_edit: "Tahrirlash",
    profile_stats: "O'rganish Statistikasi",
    profile_active_book: "Faol Kitob",
    profile_total_learned: "Yodlangan So'zlar",
    profile_streak: "Kunlik Olov (Streak)",
    profile_accuracy: "Test Aniqligi",
    profile_goal: "Kunlik Maqsad (Daily Goal)",
    profile_goal_sub: "Har kuni o'rganishni rejalashtirgan so'zlar sonini tanlang:",
    words_count: "ta so'z",
    days_count: "kun",

    // Language Selector
    profile_language: "Ilova Tili (App Language)",
    profile_language_sub: "Ilovaning asosiy interfeys tilini tanlang:",
    lang_switched_alert: "Ilova tili muvaffaqiyatli o'zgartirildi! 🌐",

    // Reminders
    profile_reminders: "Kunlik Eslatmalar",
    profile_push_notif: "Push-xabarnomalar",
    profile_notif_time: "Eslatish vaqti:",

    // VIP & Purchases
    profile_vip_section: "VIP Obuna & Xaridlar",
    profile_vip_sub: "Barcha kitoblar, audio va video treylerlarga to'liq kirish",
    profile_vip_active: "Sizda VIP Obuna Faol",
    profile_vip_valid_until: "Amal qilish muddati:",
    profile_vip_lifetime: "Umrbod (Cheksiz VIP)",
    profile_vip_buy_monthly: "VIP Oylik Obuna Olish",
    profile_vip_extend: "VIP Obunani Uzaytirish",
    profile_books_buy: "Kitoblarni alohida xarid qilish",
    profile_books_buy_sub: "VIP obuna olmasdan, xohlagan kitobingizni bir martalik to'lov bilan sotib oling:",
    book_free_badge: "Bepul ochiq",
    book_owned_badge: "Xarid qilingan",
    book_buy_btn: "Xarid qilish",

    // Security & Management
    profile_security: "Boshqaruv & Xavfsizlik",
    profile_change_pass: "Parolni O'zgartirish",
    profile_change_pass_sub: "Hisobingiz xavfsizligini ta'minlash uchun",
    profile_reset: "Barcha Natijalarni 0 dan Boshlash",
    profile_reset_sub: "Barcha o'rganilgan so'zlar va natijalarni tozalash",
    profile_logout: "Profildan Chiqish",
    profile_logout_confirm: "Haqiqatan ham hisobingizdan chiqmoqchimisiz?",

    // Home Screen
    home_hello: "Salom",
    home_welcome: "Xush kelibsiz!",
    home_welcome_back: "Yana xush kelibsiz!",
    home_daily_streak: "Daily Streak",
    home_keep_it_up: "Barakalla!",
    home_start_today: "Bugun boshlang!",
    home_days: "kun",
    home_first_lesson: "Bugun birinchi darsni boshlang",
    home_consecutive_days: "Ketma-ket kunlar",
    home_daily_goal_label: "Kunlik Maqsad",
    home_words: "ta so'z",
    home_goal_done: "Maqsad bajarildi! 🎉",
    home_goal_todo: "Bugungi darslarni bajaring",
    home_level: "Ingliz tili darajasi",
    home_today_goal: "Bugungi Maqsad",
    home_learned_today: "Bugun o'rganildi:",
    home_congrats_goal: "Kunlik maqsad bajarildi! Baraka toping! 🎉",
    home_keep_going: "O'rganishni davom eting! 💪",
    home_books_title: "4000 Essential English Words Kitoblari",
    home_books_sub: "Book 1 dan Book 6 gacha bosqichma-bosqich o'rganing",
    home_free_badge: "Bepul",
    home_vip_badge: "VIP / Pullik",
    home_progress: "O'zlashtirish",
    home_open: "Ochish",
    home_buy_book: "Kitobni Ochish",
    home_latest_news: "Muhim Yangilik",
    home_completed: "TUGALLANDI",
    home_current_active: "Hozirgi faol",
    home_start_btn: "Boshlash ➔",
    home_continue_btn: "Davom ettirish ➔",
    home_click_to_buy: "Sotib olish uchun bosing 💳",
    home_unlocks_after: "oldin ochiladi",

    // Learn Screen
    learn_title: "Darslar & So'zlar",
    learn_select_book: "Kitobni tanlang:",
    learn_units_count: "30 ta Unit",
    learn_unit: "Unit",
    learn_start_unit: "Unitni Boshlash",
    learn_completed: "Tugallangan",
    learn_locked_payment: "Pullik Rejimda",
    learn_locked_progression: "Qulflangan",
    learn_back_book1: "Book 1 ga o'tish",
    learn_definition: "Ta'rifi:",
    learn_example: "Misol:",
    learn_movie_clip: "🎬 Kinodan parcha",

    // My Words Screen
    mywords_title: "Mening Lug'atim & Tarjimon",
    mywords_search_placeholder: "So'z yoki tarjimasini qidirish...",
    mywords_input_placeholder: "Yangi so'z yozing (aple, cat, kitob...)",
    mywords_add_btn: "Qo'shish",
    mywords_added_success: "So'z muvaffaqiyatli qo'shildi!",
    mywords_empty: "Lug'atingizda hali so'zlar yo'q",
    mywords_edit_title: "Kartochkani Tahrirlash",
    mywords_save: "Saqlash",
    mywords_cancel: "Bekor qilish",

    // Flashcards & Quiz
    cards_title: "Flashkartalar",
    cards_flip_hint: "Kartani ag'darish uchun ustiga bosing",
    cards_know: "Bilaman",
    cards_learn: "O'rganmoqdaman",
    cards_hard: "Qiyin",
    cards_review: "Takrorlash",
    cards_mastered: "Yodlandi",
    cards_word_counter: "So'z",
    cards_movie_clip: "Kino kontekstini ko'rish",
    quiz_title: "Bilimni Sinash (Quiz)",
    quiz_question: "Savol",
    quiz_finish: "Testni Yakunlash",
    quiz_result: "Test Natijasi",
    quiz_score: "To'plangan Ball:",
    quiz_restart: "Qaytadan Boshlash",
    quiz_next_question: "Keyingi Savol ➔",
    quiz_view_result: "Natijani Ko'rish 🏆",
    quiz_accuracy_label: "Aniqlik",
    quiz_xp_label: "Tajriba bali",
    quiz_back_to_cards: "Unit Kartochkalariga Qaytish",
    quiz_back_to_home: "Bosh Sahifaga Qaytish",

    // General & Common
    save: "Saqlash",
    cancel: "Bekor qilish",
    close: "Yopish",
    confirm: "Tasdiqlash",
    attention: "Diqqat",
    success: "Muvaffaqiyatli",
    error: "Xatolik",
    som: "so'm",
    discount: "Chegirma",
  },

  ru: {
    // Navigation
    nav_home: "Главная",
    nav_learn: "Уроки",
    nav_my_words: "Словарь",
    nav_cards: "Карточки",
    nav_quiz: "Тест",
    nav_profile: "Профиль",

    // Profile Screen
    profile_title: "Личный Профиль",
    profile_edit: "Изменить",
    profile_stats: "Статистика Обучения",
    profile_active_book: "Активная Книга",
    profile_total_learned: "Выучено Слов",
    profile_streak: "Дней подряд (Streak)",
    profile_accuracy: "Точность Тестов",
    profile_goal: "Дневная Цель (Daily Goal)",
    profile_goal_sub: "Количество слов для изучения каждый день:",
    words_count: "слов",
    days_count: "дн.",

    // Language Selector
    profile_language: "Язык Приложения (App Language)",
    profile_language_sub: "Выберите язык интерфейса приложения:",
    lang_switched_alert: "Язык приложения успешно изменен! 🌐",

    // Reminders
    profile_reminders: "Ежедневные Напоминания",
    profile_push_notif: "Push-уведомления",
    profile_notif_time: "Время напоминания:",

    // VIP & Purchases
    profile_vip_section: "VIP Подписка и Покупки",
    profile_vip_sub: "Полный доступ ко всем книгам, аудио и видео трейлерам",
    profile_vip_active: "У вас Активна VIP Подписка",
    profile_vip_valid_until: "Действует до:",
    profile_vip_lifetime: "Навсегда (Бессрочный VIP)",
    profile_vip_buy_monthly: "Оформить VIP на Месяц",
    profile_vip_extend: "Продлить VIP Подписку",
    profile_books_buy: "Купить книги по отдельности",
    profile_books_buy_sub: "Покупайте любые книги разовым платежом без VIP подписки:",
    book_free_badge: "Бесплатно",
    book_owned_badge: "Куплено",
    book_buy_btn: "Купить книгу",

    // Security & Management
    profile_security: "Управление и Безопасность",
    profile_change_pass: "Сменить Пароль",
    profile_change_pass_sub: "Для защиты вашей учетной записи",
    profile_reset: "Сбросить Весь Прогресс",
    profile_reset_sub: "Очистить все выученные слова и историю",
    profile_logout: "Выйти из Профиля",
    profile_logout_confirm: "Вы действительно хотите выйти из аккаунта?",

    // Home Screen
    home_hello: "Привет",
    home_welcome: "Добро пожаловать!",
    home_welcome_back: "С возвращением!",
    home_daily_streak: "Daily Streak",
    home_keep_it_up: "Так держать!",
    home_start_today: "Начните сегодня!",
    home_days: "дн.",
    home_first_lesson: "Начните первый урок сегодня",
    home_consecutive_days: "Дней подряд",
    home_daily_goal_label: "Дневная Цель",
    home_words: "слов",
    home_goal_done: "Цель достигнута! 🎉",
    home_goal_todo: "Выполните сегодняшние уроки",
    home_level: "Уровень английского",
    home_today_goal: "Цель на Сегодня",
    home_learned_today: "Выучено сегодня:",
    home_congrats_goal: "Дневная цель выполнена! Отличная работа! 🎉",
    home_keep_going: "Продолжайте обучение! 💪",
    home_books_title: "Книги 4000 Essential English Words",
    home_books_sub: "Изучайте шаг за шагом от Book 1 до Book 6",
    home_free_badge: "Бесплатно",
    home_vip_badge: "VIP / Платно",
    home_progress: "Прогресс",
    home_open: "Открыть",
    home_buy_book: "Открыть Книгу",
    home_latest_news: "Важная Новость",
    home_completed: "ЗАВЕРШЕНО",
    home_current_active: "Текущая",
    home_start_btn: "Начать ➔",
    home_continue_btn: "Продолжить ➔",
    home_click_to_buy: "Нажмите для покупки 💳",
    home_unlocks_after: "Откроется после",

    // Learn Screen
    learn_title: "Уроки и Слова",
    learn_select_book: "Выберите книгу:",
    learn_units_count: "30 Юнитов",
    learn_unit: "Юнит",
    learn_start_unit: "Начать Юнит",
    learn_completed: "Пройдено",
    learn_locked_payment: "Платный Режим",
    learn_locked_progression: "Заблокировано",
    learn_back_book1: "Перейти к Book 1",
    learn_definition: "Определение:",
    learn_example: "Пример:",
    learn_movie_clip: "🎬 Отрывок из фильма",

    // My Words Screen
    mywords_title: "Мой Словарь и Переводчик",
    mywords_search_placeholder: "Поиск слова или перевода...",
    mywords_input_placeholder: "Введите новое слово (apple, cat, книга...)",
    mywords_add_btn: "Добавить",
    mywords_added_success: "Слово успешно добавлено!",
    mywords_empty: "В вашем словаре пока нет слов",
    mywords_edit_title: "Редактировать Карточку",
    mywords_save: "Сохранить",
    mywords_cancel: "Отмена",

    // Flashcards & Quiz
    cards_title: "Флешкарточки",
    cards_flip_hint: "Нажмите на карточку, чтобы перевернуть",
    cards_know: "Знаю",
    cards_learn: "Учу",
    cards_hard: "Трудно",
    cards_review: "Повторить",
    cards_mastered: "Выучено",
    cards_word_counter: "Слово",
    cards_movie_clip: "Смотреть контекст из фильма",
    quiz_title: "Проверка Знаний (Quiz)",
    quiz_question: "Вопрос",
    quiz_finish: "Завершить Тест",
    quiz_result: "Результат Теста",
    quiz_score: "Набранные Баллы:",
    quiz_restart: "Начать Заново",
    quiz_next_question: "Следующий вопрос ➔",
    quiz_view_result: "Посмотреть результат 🏆",
    quiz_accuracy_label: "Точность",
    quiz_xp_label: "Опыт XP",
    quiz_back_to_cards: "Вернуться к карточкам",
    quiz_back_to_home: "На Главную",

    // General & Common
    save: "Сохранить",
    cancel: "Отмена",
    close: "Закрыть",
    confirm: "Подтвердить",
    attention: "Внимание",
    success: "Успешно",
    error: "Ошибка",
    som: "сум",
    discount: "Скидка",
  },

  en: {
    // Navigation
    nav_home: "Home",
    nav_learn: "Learn",
    nav_my_words: "My Words",
    nav_cards: "Flashcards",
    nav_quiz: "Quiz",
    nav_profile: "Profile",

    // Profile Screen
    profile_title: "Personal Profile",
    profile_edit: "Edit",
    profile_stats: "Learning Statistics",
    profile_active_book: "Active Book",
    profile_total_learned: "Words Learned",
    profile_streak: "Daily Streak",
    profile_accuracy: "Quiz Accuracy",
    profile_goal: "Daily Goal",
    profile_goal_sub: "Number of words you plan to learn each day:",
    words_count: "words",
    days_count: "days",

    // Language Selector
    profile_language: "App Language",
    profile_language_sub: "Select the main app interface language:",
    lang_switched_alert: "App language successfully updated! 🌐",

    // Reminders
    profile_reminders: "Daily Reminders",
    profile_push_notif: "Push Notifications",
    profile_notif_time: "Reminder Time:",

    // VIP & Purchases
    profile_vip_section: "VIP Subscription & Purchases",
    profile_vip_sub: "Full access to all books, audio and video trailers",
    profile_vip_active: "You Have Active VIP",
    profile_vip_valid_until: "Valid until:",
    profile_vip_lifetime: "Lifetime VIP",
    profile_vip_buy_monthly: "Get Monthly VIP",
    profile_vip_extend: "Extend VIP",
    profile_books_buy: "Purchase Individual Books",
    profile_books_buy_sub: "Buy any book with a one-time purchase without VIP:",
    book_free_badge: "Free Access",
    book_owned_badge: "Purchased",
    book_buy_btn: "Buy Book",

    // Security & Management
    profile_security: "Security & Account",
    profile_change_pass: "Change Password",
    profile_change_pass_sub: "To keep your account secure",
    profile_reset: "Reset All Progress",
    profile_reset_sub: "Clear all learned words and stats",
    profile_logout: "Log Out",
    profile_logout_confirm: "Are you sure you want to log out?",

    // Home Screen
    home_hello: "Hello",
    home_welcome: "Welcome!",
    home_welcome_back: "Welcome back!",
    home_daily_streak: "Daily Streak",
    home_keep_it_up: "Keep it up!",
    home_start_today: "Start today!",
    home_days: "days",
    home_first_lesson: "Start your first lesson today",
    home_consecutive_days: "Days streak",
    home_daily_goal_label: "Daily Goal",
    home_words: "words",
    home_goal_done: "Goal achieved! 🎉",
    home_goal_todo: "Complete today's lessons",
    home_level: "English Level",
    home_today_goal: "Today's Goal",
    home_learned_today: "Learned today:",
    home_congrats_goal: "Daily goal achieved! Well done! 🎉",
    home_keep_going: "Keep on learning! 💪",
    home_books_title: "4000 Essential English Words",
    home_books_sub: "Learn step-by-step from Book 1 to Book 6",
    home_free_badge: "Free",
    home_vip_badge: "VIP / Paid",
    home_progress: "Progress",
    home_open: "Open",
    home_buy_book: "Unlock Book",
    home_latest_news: "Latest News",
    home_completed: "COMPLETED",
    home_current_active: "Current Active",
    home_start_btn: "Start ➔",
    home_continue_btn: "Continue ➔",
    home_click_to_buy: "Tap to unlock 💳",
    home_unlocks_after: "Unlocks after",

    // Learn Screen
    learn_title: "Lessons & Words",
    learn_select_book: "Select book:",
    learn_units_count: "30 Units",
    learn_unit: "Unit",
    learn_start_unit: "Start Unit",
    learn_completed: "Completed",
    learn_locked_payment: "Premium Required",
    learn_locked_progression: "Locked",
    learn_back_book1: "Back to Book 1",
    learn_definition: "Definition:",
    learn_example: "Example:",
    learn_movie_clip: "🎬 Movie Clip",

    // My Words Screen
    mywords_title: "My Dictionary & Translator",
    mywords_search_placeholder: "Search word or translation...",
    mywords_input_placeholder: "Enter new word (apple, cat, book...)",
    mywords_add_btn: "Add",
    mywords_added_success: "Word successfully added!",
    mywords_empty: "No custom words in your dictionary yet",
    mywords_edit_title: "Edit Card",
    mywords_save: "Save",
    mywords_cancel: "Cancel",

    // Flashcards & Quiz
    cards_title: "Flashcards",
    cards_flip_hint: "Tap card to flip",
    cards_know: "I Know",
    cards_learn: "Learning",
    cards_hard: "Hard",
    cards_review: "Review",
    cards_mastered: "Mastered",
    cards_word_counter: "Word",
    cards_movie_clip: "Watch movie clip",
    quiz_title: "Knowledge Quiz",
    quiz_question: "Question",
    quiz_finish: "Finish Quiz",
    quiz_result: "Quiz Results",
    quiz_score: "Total Score:",
    quiz_restart: "Try Again",
    quiz_next_question: "Next Question ➔",
    quiz_view_result: "View Results 🏆",
    quiz_accuracy_label: "Accuracy",
    quiz_xp_label: "Experience XP",
    quiz_back_to_cards: "Back to Flashcards",
    quiz_back_to_home: "Back to Home",

    // General & Common
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    confirm: "Confirm",
    attention: "Notice",
    success: "Success",
    error: "Error",
    som: "UZS",
    discount: "Discount",
  }
};

let activeLanguage = 'uz';
const listeners = new Set();

export function getAppLanguage() {
  return activeLanguage;
}

export async function initLanguage() {
  try {
    const saved = await getStorageItem(STORAGE_KEY_LANGUAGE, 'uz');
    if (saved && (saved === 'uz' || saved === 'ru' || saved === 'en')) {
      activeLanguage = saved;
    }
  } catch (e) {
    activeLanguage = 'uz';
  }
  return activeLanguage;
}

export async function setAppLanguage(langCode) {
  if (langCode === 'uz' || langCode === 'ru' || langCode === 'en') {
    activeLanguage = langCode;
    await setStorageItem(STORAGE_KEY_LANGUAGE, langCode);
    listeners.forEach(fn => {
      try { fn(activeLanguage); } catch (e) {}
    });
  }
}

export function onLanguageChange(callback) {
  listeners.add(callback);
  callback(activeLanguage);
  return () => listeners.delete(callback);
}

export function t(key, fallback = null) {
  const dict = translations[activeLanguage] || translations.uz;
  if (dict && dict[key] !== undefined) {
    return dict[key];
  }
  // Fallback to Uzbek if missing in current
  if (translations.uz && translations.uz[key] !== undefined) {
    return translations.uz[key];
  }
  return fallback !== null ? fallback : key;
}
