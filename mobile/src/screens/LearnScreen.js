/**
 * INGLY MOBILE - LEARN SCREEN (Book Units Overview)
 * 4000 Essential English Words - 6 ta kitob va 180 ta unit.
 * Yangi foydalanuvchi uchun barcha darslar 0 dan boshlanadi.
 * Book 1 Unit 1 faol (boshlang'ich), qolganlari bosqichma-bosqich ochiladi.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { colors, booksConfig } from '../theme.js';
import { useUser } from '../context/UserContext.js';

export default function LearnScreen({ onNavigate }) {
  const { user } = useUser();
  const [selectedBook, setSelectedBook] = useState(1);

  // Tanlangan kitob ochiqmi? (Book 1 har doim ochiq, boshqalari oldingi kitob progressi 100% bo'lganda)
  const isBookUnlocked =
    selectedBook === 1 || (user.bookProgress[selectedBook - 1] || 0) >= 100;

  // Foydalanuvchining ushbu kitobdagi o'rganilgan so'zlari
  // Har bir kitobda 30 ta unit, har bir unitda 20 ta so'z (jami 600 ta so'z)
  const bookBaseWords = (selectedBook - 1) * 600;
  const wordsInThisBook = Math.max(
    0,
    Math.min(600, user.totalWordsLearned - bookBaseWords)
  );

  const completedUnitsCount = Math.floor(wordsInThisBook / 20);
  const currentActiveUnit = completedUnitsCount + 1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerBox}>
          <Text style={styles.title}>Darslar va Unitlar</Text>
          <Text style={styles.subtitle}>
            4000 Essential English Words - 6 ta kitob va 180 ta unit
          </Text>
        </View>

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
            <Text style={styles.lockedNoticeTitle}>Book {selectedBook} Qulflangan</Text>
            <Text style={styles.lockedNoticeText}>
              Ushbu kitobni ochish uchun avval Book {selectedBook - 1} ning barcha 30 ta unitini tugatishingiz kerak.
            </Text>
            <TouchableOpacity
              style={styles.backToBook1Btn}
              onPress={() => setSelectedBook(1)}
            >
              <Text style={styles.backToBook1Text}>Book 1 ga o'tish ➔</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Units Grid */
          <View style={styles.unitsGrid}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((unitNum) => {
              const isCompleted = unitNum <= completedUnitsCount;
              const isCurrent = unitNum === currentActiveUnit;
              const isLocked = unitNum > currentActiveUnit;

              return (
                <TouchableOpacity
                  key={unitNum}
                  activeOpacity={0.8}
                  disabled={isLocked}
                  onPress={() => onNavigate && onNavigate('Flashcards')}
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
                      <Text style={styles.startBtnSmallText}>O'rganish ➔</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
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
});
