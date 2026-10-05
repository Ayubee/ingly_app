/**
 * INGLY MOBILE - LEARN SCREEN (Book Units Overview)
 * 4000 Essential English Words - 6 ta kitob va 180 ta unit.
 * Yangi foydalanuvchi uchun barcha darslar 0 dan boshlanadi.
 * Book 1 Unit 1 faol (boshlang'ich), qolganlari bosqichma-bosqich ochiladi.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { colors, booksConfig } from '../theme.js';
import { useUser } from '../context/UserContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { onSettingsChange, getAppSettings } from '../services/appSettingsService.js';
import PaymentModal from '../components/PaymentModal.js';
import { captureStorageSession, isStorageSessionCurrent } from '../services/storage.js';

export default function LearnScreen({ onNavigate }) {
  const { user, setActiveLesson, subscribeVipMonthly, purchaseBook, isVipActive } = useUser();
  const { t } = useLanguage();
  const [selectedBook, setSelectedBook] = useState(user?.activeBook || 1);
  const [appSettings, setAppSettings] = useState(getAppSettings());
  const account = useRef(captureStorageSession());
  account.current = captureStorageSession();

  const [paymentModal, setPaymentModal] = useState({
    visible: false,
    itemType: 'book',
    itemTitle: '',
    price: 19000,
    bookId: null,
  });

  useEffect(() => {
    const unsub = onSettingsChange((st) => {
      if (st) setAppSettings({ ...st });
    });
    return () => unsub();
  }, []);

  const handlePaymentSuccess = async (details) => {
    setPaymentModal((prev) => ({ ...prev, visible: false }));
    if (details.mock !== true) return;
    const result = details.itemType === 'vip'
      ? await subscribeVipMonthly(details)
      : await purchaseBook(details.bookId, details);
    Alert.alert('TEST/MOCK', result?.success
      ? 'Sinov uchun ochildi. Haqiqiy xarid yoki obuna yaratilmagan.'
      : (result?.error || 'Sinov yakunlanmadi.'));
  };

  const handleOpenUnit = async (unitNum) => {
    const session = account.current;
    if (!isStorageSessionCurrent(session)) return;
    try { if (setActiveLesson) await setActiveLesson(selectedBook, unitNum); }
    catch { Alert.alert('Saqlash xatosi', 'Dars tanlovi saqlanmadi.'); return; }
    if (isStorageSessionCurrent(session) && onNavigate) {
      onNavigate('Flashcards');
    }
  };

  // Tanlangan kitob ochiqmi?
  const freeCount = appSettings.free_books_count !== undefined ? appSettings.free_books_count : 1;
  const freeBookIds = Array.isArray(appSettings.free_book_ids) ? appSettings.free_book_ids : [1];
  const isFreeBook = selectedBook <= freeCount || freeBookIds.includes(selectedBook);
  const isBookPurchased = isVipActive || isFreeBook || (Array.isArray(user.unlockedBooks) && user.unlockedBooks.includes(selectedBook));
  const isBookLockedByPayment = appSettings.premium_mode_enabled && !isFreeBook && !isBookPurchased;
  const isBookProgressionLocked = !isBookLockedByPayment && !isFreeBook && selectedBook !== 1 && (user.bookProgress[selectedBook - 1] || 0) < 100;
  const isBookUnlocked = !isBookLockedByPayment && !isBookProgressionLocked;

  // Foydalanuvchining ushbu kitobdagi o'rganilgan so'zlari
  // Har bir kitobda 30 ta unit, har bir unitda 20 ta so'z (jami 600 ta so'z)
  const wordsInThisBook = Math.max(
    0,
    Math.min(600, user.bookLearnedCounts?.[selectedBook] ?? Math.round((user.bookProgress?.[selectedBook] || 0) * 6))
  );

  const currentActiveUnit = Array.from({ length: 30 }, (_, i) => i + 1)
    .find(unit => !user.completedUnits?.[`${selectedBook}:${unit}`]) || 31;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerBox}>
          <Text style={styles.title}>{t('learn_title', 'Darslar va Unitlar')}</Text>
          <Text style={styles.subtitle}>
            4000 Essential English Words - 6 ta kitob va 180 ta unit
          </Text>
        </View>

        {/* Shaxsiy Lug'atga tezkor o'tish */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onNavigate && onNavigate('MyWords')}
          style={styles.customWordsShortcut}
        >
          <View style={styles.customWordsShortcutIcon}>
            <Text style={{ fontSize: 18 }}>✍️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customWordsShortcutTitle}>{t('mywords_title', "Shaxsiy Lug'at & Tarjimon")}</Text>
            <Text style={styles.customWordsShortcutSub}>
              {t('mywords_input_placeholder', "O'zingiz istagan so'zlarni tarjima qilib kartochkalarda yodlang")}
            </Text>
          </View>
          <Text style={styles.customWordsShortcutArrow}>➔</Text>
        </TouchableOpacity>

        {/* Book Tabs (Gorizontal aylantirish) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {booksConfig.map((b) => {
            const isSelected = selectedBook === b.book;
            const bookProgress = user.bookProgress[b.book] || 0;
            const isUnlocked =
              b.book === 1 || (user.bookProgress[b.book - 1] || 0) >= 100;

            return (
              <TouchableOpacity
                key={b.book}
                activeOpacity={0.8}
                onPress={() => setSelectedBook(b.book)}
                style={[
                  styles.bookTab,
                  isSelected && styles.bookTabActive,
                  !isUnlocked && styles.bookTabLocked,
                ]}
              >
                <View style={styles.tabHeaderRow}>
                  <Text
                    style={[
                      styles.bookTabText,
                      isSelected && styles.bookTabActiveText,
                    ]}
                  >
                    Book {b.book}
                  </Text>
                  {!isUnlocked && <Text style={styles.tabLockEmoji}>🔒</Text>}
                </View>
                <Text
                  style={[
                    styles.badgeText,
                    isSelected && styles.badgeActiveText,
                  ]}
                >
                  {isUnlocked ? `${bookProgress}% o'rganildi` : b.badgeText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Agar butun kitob qulflangan bo'lsa */}
        {!isBookUnlocked ? (
          <View style={styles.lockedBookNotice}>
            <Text style={styles.lockedNoticeIcon}>🔒</Text>
            <Text style={styles.lockedNoticeTitle}>
              Book {selectedBook} {isBookLockedByPayment ? 'Pullik Rejimda' : 'Qulflangan'}
            </Text>
            <Text style={styles.lockedNoticeText}>
              {isBookLockedByPayment
                ? `Ushbu kitob pullik obunaga kiritilgan (${appSettings.single_book_original_price ? `${Number(appSettings.single_book_original_price).toLocaleString('uz-UZ')} so'm o'rniga chegirmada ` : ''}${Number(appSettings.single_book_price || 19000).toLocaleString('uz-UZ')} so'm). Siz uni karta, Click yoki Payme orqali alohida xarid qilishingiz yoki VIP obuna bo'lishingiz mumkin.`
                : `Ushbu kitobni ochish uchun avval Book ${selectedBook - 1} ning barcha 30 ta unitini tugatishingiz kerak.`}
            </Text>

            {isBookLockedByPayment && (
              <TouchableOpacity
                style={[styles.backToBook1Btn, { backgroundColor: colors.primary.DEFAULT, marginBottom: 10 }]}
                onPress={() => {
                  setPaymentModal({
                    visible: true,
                    itemType: 'book',
                    itemTitle: `Book ${selectedBook} (To'liq ochish)`,
                    price: appSettings.single_book_price || 19000,
                    originalPrice: appSettings.single_book_original_price || 35000,
                    bookId: selectedBook,
                  });
                }}
              >
                <Text style={styles.backToBook1Text}>Kitobni xarid qilish 💳</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.backToBook1Btn, isBookLockedByPayment && { backgroundColor: '#F1F5F9' }]}
              onPress={() => setSelectedBook(1)}
            >
              <Text style={[styles.backToBook1Text, isBookLockedByPayment && { color: '#475569' }]}>
                Book 1 ga o'tish ➔
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Units Grid */
          <View style={styles.unitsGrid}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((unitNum) => {
              const isCompleted = !!user.completedUnits?.[`${selectedBook}:${unitNum}`];
              const isCurrent = unitNum === currentActiveUnit;
              const isLocked = unitNum > currentActiveUnit;

              return (
                <TouchableOpacity
                  key={unitNum}
                  activeOpacity={0.8}
                  onPress={() => handleOpenUnit(unitNum)}
                  style={[
                    styles.unitCard,
                    isCurrent && styles.unitCardCurrent,
                    isCompleted && styles.unitCardCompleted,
                    isLocked && styles.unitCardLocked,
                  ]}
                >
                  <View style={styles.unitHeader}>
                    <Text
                      style={[
                        styles.unitNumber,
                        isCurrent && styles.unitNumberCurrent,
                        isLocked && styles.unitNumberLocked,
                      ]}
                    >
                      Unit {unitNum}
                    </Text>
                    {isCompleted ? (
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedMark}>✓</Text>
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentMark}>▶</Text>
                      </View>
                    ) : (
                      <Text style={styles.lockedMark}>🔒</Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.unitWordsCount,
                      isCurrent && styles.unitWordsCountCurrent,
                    ]}
                  >
                    {isCompleted ? '20/20 yodlandi' : isCurrent ? '0/20 boshlash' : '20 ta so\'z'}
                  </Text>

                  <Text style={styles.unitRange}>
                    {unitNum * 20 - 19} - {unitNum * 20}-so'zlar
                  </Text>

                  {isCurrent && (
                    <View style={styles.startBtnSmall}>
                      <Text style={styles.startBtnSmallText}>{t('home_start_btn', "O'rganish ➔")}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Universal To'lov Modali (Click, Payme, Bank Karta) */}
      <PaymentModal
        visible={paymentModal.visible}
        onClose={() => setPaymentModal((prev) => ({ ...prev, visible: false }))}
        itemType={paymentModal.itemType}
        itemTitle={paymentModal.itemTitle}
        price={paymentModal.price}
        originalPrice={paymentModal.originalPrice}
        bookId={paymentModal.bookId}
        onSuccess={handlePaymentSuccess}
        userPhone={user.phone}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 40,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
    paddingHorizontal: 2,
  },
  bookTab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minWidth: 100,
  },
  bookTabActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#EEF0FF',
  },
  bookTabLocked: {
    opacity: 0.7,
    backgroundColor: '#F8FAFC',
  },
  tabHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  bookTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  bookTabActiveText: {
    color: colors.primary.DEFAULT,
  },
  tabLockEmoji: {
    fontSize: 10,
  },
  badgeText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  badgeActiveText: {
    color: colors.primary.DEFAULT,
    fontWeight: '700',
  },
  lockedBookNotice: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  lockedNoticeIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  lockedNoticeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  lockedNoticeText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  backToBook1Btn: {
    marginTop: 16,
    backgroundColor: colors.primary.DEFAULT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backToBook1Text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 6,
  },
  unitCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 105,
    justifyContent: 'space-between',
  },
  unitCardCurrent: {
    borderWidth: 2,
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  unitCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  unitCardLocked: {
    backgroundColor: '#FAFCFE',
    opacity: 0.65,
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitNumberCurrent: {
    color: colors.primary.DEFAULT,
  },
  unitNumberLocked: {
    color: '#94A3B8',
  },
  completedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedMark: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  currentBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentMark: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  lockedMark: {
    fontSize: 13,
  },
  unitWordsCount: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '600',
  },
  unitWordsCountCurrent: {
    color: colors.primary.DEFAULT,
    fontWeight: '700',
  },
  unitRange: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  startBtnSmall: {
    backgroundColor: '#EEF0FF',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
    marginTop: 6,
  },
  startBtnSmallText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },
  customWordsShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4.5,
    borderLeftColor: colors.primary.DEFAULT,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  customWordsShortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customWordsShortcutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  customWordsShortcutSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  customWordsShortcutArrow: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },
});
