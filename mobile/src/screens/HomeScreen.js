/**
 * INGLY MOBILE - HOME SCREEN
 * Foydalanuvchi progressi (0 dan boshlanishi), markazlashtirilgan chiroyli dizayn,
 * 6 ta kitob bo'yicha dinamik statuslar va tezkor o'tishlar.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { colors } from '../theme.js';
import CircularProgress from '../components/CircularProgress.js';
import { useUser } from '../context/UserContext.js';
import { onSettingsChange } from '../services/appSettingsService.js';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2;

const BOOKS_METADATA = [
  { id: 1, title: 'Book 1 - Elementary', level: 'A1 - A2', icon: '📕', unitsCount: 30 },
  { id: 2, title: 'Book 2 - Pre-Int', level: 'A2 - B1', icon: '🎓', unitsCount: 30 },
  { id: 3, title: 'Book 3 - Intermediate', level: 'B1', icon: '📘', unitsCount: 30 },
  { id: 4, title: 'Book 4 - Upper-Int', level: 'B2', icon: '📙', unitsCount: 30 },
  { id: 5, title: 'Book 5 - Advanced', level: 'C1', icon: '📓', unitsCount: 30 },
  { id: 6, title: 'Book 6 - Mastery', level: 'C1 - C2', icon: '🏆', unitsCount: 30 },
];

export default function HomeScreen({ onNavigate }) {
  const { user, isPasswordExpired } = useUser();
  const [appSettings, setAppSettings] = useState({
    ads_enabled: false,
    premium_mode_enabled: false,
    free_books_count: 6,
  });

  useEffect(() => {
    const unsub = onSettingsChange((st) => {
      if (st) setAppSettings({ ...st });
    });
    return () => unsub();
  }, []);

  const userDailyGoal = user.dailyGoal && user.dailyGoal > 0 ? user.dailyGoal : 20;
  const userWordsToday = user.wordsLearnedToday || 0;
  const dailyGoalPercent = Math.min(
    100,
    Math.round((userWordsToday / userDailyGoal) * 100)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header Title (Mukammal markazda) */}
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>4000 ESSENTIAL ENGLISH WORDS</Text>
        </View>

        {/* 2. User Profile & Daily Stats Card */}
        <View style={styles.userStatsContainer}>
          {/* Left: User Profile */}
          <TouchableOpacity
            style={styles.userProfileSection}
            activeOpacity={0.8}
            onPress={() => onNavigate && onNavigate('Profile')}
          >
            <View style={styles.avatarBorder}>
              <Text style={styles.avatarEmoji}>{user.avatar || '👨‍🎓'}</Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name || 'O\'quvchi'}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              {user.streakDays === 0 ? 'Xush kelibsiz!' : 'Yana xush kelibsiz!'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.verticalDivider} />

          {/* Right: Daily Streak & Daily Goal */}
          <View style={styles.dailyStatsSection}>
            {/* Daily Streak */}
            <View style={styles.streakRow}>
              <Text style={styles.streakFlameIcon}>🔥</Text>
              <View style={styles.streakTextBox}>
                <View style={styles.streakTitleRow}>
                  <Text style={styles.statLabel}>Daily Streak</Text>
                  <View style={styles.keepItUpBadge}>
                    <Text style={styles.keepItUpText}>
                      {user.streakDays > 0 ? 'Keep it up!' : 'Start today!'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.streakNumber}>{user.streakDays} Days</Text>
                <Text style={styles.statSubtext}>
                  {user.streakDays === 0 ? 'Bugun birinchi darsni boshlang' : `Ketma-ket ${user.streakDays} kun`}
                </Text>
              </View>
            </View>

            {/* Daily Goal */}
            <View style={styles.goalRow}>
              <CircularProgress
                size={44}
                strokeWidth={4.5}
                percent={dailyGoalPercent}
                color={colors.primary.DEFAULT}
                trackColor="#E0F2FE"
              />
              <View style={styles.goalTextBox}>
                <Text style={styles.goalLabel}>
                  Daily Goal: {dailyGoalPercent}%
                </Text>
                <Text style={styles.goalFraction}>
                  ({userWordsToday}/{userDailyGoal} Words)
                </Text>
                <Text style={styles.statSubtext}>
                  {dailyGoalPercent === 100 ? 'Maqsad bajarildi! 🎉' : 'Bugungi darslarni bajaring'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security Reminder: 6 Month Password Expiry */}
        {isPasswordExpired && (
          <TouchableOpacity
            style={styles.securityBanner}
            activeOpacity={0.85}
            onPress={() => onNavigate && onNavigate('Profile')}
          >
            <View style={styles.securityIconBox}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={styles.securityTitle}>Parolni yangilash tavsiya etiladi</Text>
                <View style={styles.securityTag}>
                  <Text style={styles.securityTagText}>6 oy bo'ldi</Text>
                </View>
              </View>
              <Text style={styles.securitySubtitle}>
                Hisobingiz daxlsizligi uchun parolingizni yangilab turing.
              </Text>
            </View>
            <Text style={styles.securityArrow}>➔</Text>
          </TouchableOpacity>
        )}

        {/* Dynamic AdMob Banner when enabled from Admin */}
        {appSettings.ads_enabled && (
          <View style={styles.adBannerCard}>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>AD</Text>
            </View>
            <View style={styles.adTextContent}>
              <Text style={styles.adTitle}>Google AdMob Homiylik E'loni</Text>
              <Text style={styles.adSubtitle}>Admin panel orqali faollashtirilgan</Text>
            </View>
          </View>
        )}

        {/* 3. 6 Ta Kitob Bo'yicha Grid (Book 1 - Book 6) */}
        <View style={styles.booksGrid}>
          {BOOKS_METADATA.map((b) => {
            const progress = user.bookProgress[b.id] || 0;
            const isCompleted = progress === 100;
            const isVipLocked = appSettings.premium_mode_enabled && b.id > appSettings.free_books_count;
            // Book 1 har doim ochiq. Boshqa kitoblar oldingi kitob tugatilganda ochiladi.
            const isUnlocked = !isVipLocked && (b.id === 1 || (user.bookProgress[b.id - 1] || 0) >= 100);
            const isCurrentActive = isUnlocked && !isCompleted;

            // Agar Admin tomonidan VIP obunaga qulflangan bo'lsa
            if (isVipLocked) {
              return (
                <View key={b.id} style={[styles.bookCard, styles.bookCardLocked]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.bookTitle, styles.lockedTitle]} numberOfLines={2}>{b.title}</Text>
                    <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={styles.bookIconEmoji}>👑</Text>
                    </View>
                  </View>
                  <View style={styles.lockedBottom}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#D97706', marginBottom: 2 }}>🔒 VIP OBUNA</Text>
                    <Text style={styles.lockedDesc}>Admin tomonidan yopilgan</Text>
                  </View>
                </View>
              );
            }

            // 1. Tugatilgan kitob kartasi
            if (isCompleted) {
              return (
                <View key={b.id} style={[styles.bookCard, styles.bookCardCompleted]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
                    <View style={[styles.iconCircle, { backgroundColor: '#EEF0FF' }]}>
                      <Text style={styles.bookIconEmoji}>{b.icon}</Text>
                    </View>
                  </View>

                  <View style={styles.completedBadgeRow}>
                    <CircularProgress
                      size={40}
                      strokeWidth={4}
                      percent={100}
                      color="#22C55E"
                      trackColor="#DCFCE7"
                    />
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkIcon}>✓</Text>
                      <Text style={styles.checkText}>COMPLETED</Text>
                    </View>
                  </View>

                  <View style={styles.fullProgressBar}>
                    <View style={styles.fullProgressFill} />
                  </View>
                </View>
              );
            }

            // 2. Hozirgi faol ochiq kitob (Boshlash yoki Davom ettirish)
            if (isCurrentActive) {
              return (
                <View key={b.id} style={[styles.bookCard, styles.bookCardActive]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.activeTitleContainer}>
                      <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
                      <Text style={styles.currentActiveBadge}>Current Active</Text>
                    </View>
                    <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
                      <Text style={styles.bookIconEmoji}>{b.icon}</Text>
                    </View>
                  </View>

                  <Text style={styles.completedPercentText}>
                    {progress}% Completed
                  </Text>

                  {/* Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.max(5, progress)}%` },
                      ]}
                    />
                  </View>

                  <Text style={styles.unitDetailText}>
                    Unit {user.activeUnit} of 30
                  </Text>

                  {/* Continue / Start Button */}
                  <TouchableOpacity
                    style={styles.continueButton}
                    activeOpacity={0.8}
                    onPress={() => onNavigate && onNavigate('Flashcards')}
                  >
                    <Text style={styles.continueButtonText}>
                      {progress === 0 ? 'Boshlash ➔' : 'Davom ettirish ➔'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }

            // 3. Qulflangan kitoblar
            return (
              <View key={b.id} style={[styles.bookCard, styles.bookCardLocked]}>
                <View style={styles.cardHeader}>
                  <View style={styles.activeTitleContainer}>
                    <Text style={[styles.bookTitle, styles.lockedTitle]} numberOfLines={2}>
                      {b.title}
                    </Text>
                    <Text style={styles.unitsCountText}>{b.unitsCount} Units</Text>
                  </View>
                  <View style={styles.lockBadge}>
                    <Text style={styles.lockIcon}>🔒</Text>
                  </View>
                </View>

                <View style={styles.lockedBottom}>
                  <Text style={styles.lockedDesc}>Book {b.id - 1} tugagach ochiladi</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  userStatsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 18,
  },
  userProfileSection: {
    width: '32%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBorder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarEmoji: {
    fontSize: 30,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  dailyStatsSection: {
    flex: 1,
    gap: 12,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakFlameIcon: {
    fontSize: 26,
  },
  streakTextBox: {
    flex: 1,
  },
  streakTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  keepItUpBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  keepItUpText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  streakNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  statSubtext: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalTextBox: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  goalFraction: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },
  booksGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  bookCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 185,
    justifyContent: 'space-between',
  },
  bookCardActive: {
    borderWidth: 2,
    borderColor: colors.primary.DEFAULT,
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  bookCardCompleted: {
    borderColor: '#DCFCE7',
    backgroundColor: '#FAFCFA',
  },
  bookCardLocked: {
    backgroundColor: '#FAFCFE',
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  activeTitleContainer: {
    flex: 1,
    marginRight: 6,
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 17,
  },
  currentActiveBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0EA5E9',
    marginTop: 3,
  },
  unitsCountText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '600',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookIconEmoji: {
    fontSize: 16,
  },
  completedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  checkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checkIcon: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
  },
  checkText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  fullProgressBar: {
    height: 5,
    backgroundColor: '#DCFCE7',
    borderRadius: 9999,
    overflow: 'hidden',
    marginTop: 6,
  },
  fullProgressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#22C55E',
  },
  completedPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 9999,
    overflow: 'hidden',
    marginVertical: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 9999,
  },
  unitDetailText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  continueButton: {
    borderWidth: 1.5,
    borderColor: colors.primary.DEFAULT,
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  continueButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 14,
  },
  lockedTitle: {
    color: '#475569',
  },
  lockedBottom: {
    marginTop: 10,
  },
  lockedDesc: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  adBannerCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
  },
  adBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  adBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  adTextContent: {
    flex: 1,
  },
  adTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  adSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#3B82F6',
    marginTop: 2,
  },
  securityBanner: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  securityIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  securityTag: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  securityTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  securitySubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#B45309',
  },
  securityArrow: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D97706',
  },
});
