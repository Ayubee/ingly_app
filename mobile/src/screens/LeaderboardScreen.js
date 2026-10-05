/**
 * INGLY MOBILE - LEADERBOARD SCREEN
 * 
 * Foydalanuvchilar o'rtasida kim ko'p so'z yodlagani, shaxsiy lug'atdagi natijalari
 * va o'qishiga qarab doimiy oshib boruvchi DARAJA (LEVEL) statistikasi.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { colors } from '../theme.js';
import { useUser } from '../context/UserContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { captureStorageSession, isStorageSessionCurrent } from '../services/storage.js';
import {
  fetchLeaderboard,
  getUserLevelInfo,
  syncUserLeaderboardScore,
  LEVELS_CONFIG,
} from '../services/leaderboardService.js';

const { width } = Dimensions.get('window');

export default function LeaderboardScreen({ onNavigate }) {
  const { user } = useUser();
  const { t, language } = useLanguage();

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'books' | 'custom'

  // Ma'lumotlarni yuklash
  const loadData = useCallback(async (isPullRefresh = false) => {
    const session = captureStorageSession();
    if (!isPullRefresh) setLoading(true);
    try {
      // Avval joriy foydalanuvchi ballini serverga sinxron qilamiz
      await syncUserLeaderboardScore(user, session);
      const data = await fetchLeaderboard(user, session);
      if (isStorageSessionCurrent(session) && Array.isArray(data)) {
        setLeaderboard(data);
      }
    } catch (e) {
      console.warn('Leaderboard load error:', e);
    } finally {
      if (isStorageSessionCurrent(session)) { setLoading(false); setRefreshing(false); }
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Tanlangan filtrga ko'ra saralangan ro'yxat
  const displayList = useMemo(() => {
    let sorted = [...leaderboard];
    if (filterType === 'books') {
      sorted.sort((a, b) => (b.bookWords || 0) - (a.bookWords || 0));
    } else if (filterType === 'custom') {
      sorted.sort((a, b) => (b.customWords || 0) - (a.customWords || 0));
    } else {
      sorted.sort((a, b) => (b.totalWords || 0) - (a.totalWords || 0));
    }

    // Qayta o'rin berish
    return sorted.map((u, i) => ({
      ...u,
      displayRank: i + 1,
    }));
  }, [leaderboard, filterType]);

  // Joriy foydalanuvchining reytingdagi holati
  const currentUserEntry = useMemo(() => {
    const cleanUser = String(user?.username || '').toLowerCase().replace(/^@/, '').trim();
    const found = displayList.find(u => String(u.username || '').toLowerCase().replace(/^@/, '').trim() === cleanUser);
    if (found) return found;

    // Agar ro'yxatda topilmasa, o'zinikini hisoblab qaytaramiz
    const totalW = (user?.totalWordsLearned || 0);
    const lvl = getUserLevelInfo(totalW);
    return {
      username: cleanUser || 'user',
      name: user?.name || 'Siz',
      avatar: user?.avatar || '👨‍🎓',
      displayRank: displayList.length + 1,
      totalWords: totalW,
      bookWords: totalW,
      customWords: 0,
      xp: (totalW * 10),
      streak: user?.streakDays || 0,
      level: lvl.level,
      levelTitle: lvl.titleUz,
      levelIcon: lvl.icon,
      isPremium: !!user?.isPremium,
    };
  }, [displayList, user]);

  // Joriy foydalanuvchining level detallari
  const myLevelInfo = useMemo(() => {
    return getUserLevelInfo(currentUserEntry.totalWords || user?.totalWordsLearned || 0);
  }, [currentUserEntry, user]);

  // Top 3 o'quvchilar
  const top1 = displayList[0] || null;
  const top2 = displayList[1] || null;
  const top3 = displayList[2] || null;
  const restList = displayList.slice(3);

  // Daraja nomini joriy tilga moslash
  const getLocalizedLevelTitle = (levelNum) => {
    const cfg = LEVELS_CONFIG.find(c => c.level === levelNum) || LEVELS_CONFIG[0];
    if (language === 'ru') return cfg.titleRu;
    if (language === 'en') return cfg.titleEn;
    return cfg.titleUz;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.DEFAULT]}
            tintColor={colors.primary.DEFAULT}
          />
        }
      >
        {/* 1. Header */}
        <View style={styles.headerBox}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Text style={styles.headerBadge}>INGLY LEADERBOARD</Text>
                <Text style={styles.headerDot}>•</Text>
                <Text style={styles.headerSubBadge}>Reyting & Darajalar</Text>
              </View>
              <Text style={styles.title}>{t('leaderboard_title', "Top O'quvchilar Reytingi")}</Text>
              <Text style={styles.subtitle}>
                {t('leaderboard_subtitle', "Eng ko'p so'z yodlagan faol talabalar jadvali")}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => loadData(false)}
              style={styles.refreshBtn}
            >
              <Text style={{ fontSize: 18 }}>🔄</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Sizning Natijangiz va O'sib Boruvchi Darajangiz (My Rank Card) */}
        <View style={styles.myRankCard}>
          <View style={styles.myRankHeader}>
            <View style={styles.myRankAvatarBox}>
              <Text style={styles.myRankAvatar}>{user?.avatar || '👨‍🎓'}</Text>
              {user?.isPremium && (
                <View style={styles.crownBadge}>
                  <Text style={{ fontSize: 11 }}>👑</Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.myRankName} numberOfLines={1}>
                  {user?.name || 'Siz'}
                </Text>
                <View style={styles.rankPill}>
                  <Text style={styles.rankPillText}>
                    #{currentUserEntry.displayRank} {t('leaderboard_rank', "O'rin")}
                  </Text>
                </View>
              </View>

              {/* Daraja (Level) Pill */}
              <View style={styles.myLevelPillRow}>
                <View style={[styles.myLevelBadge, { backgroundColor: myLevelInfo.color + '22', borderColor: myLevelInfo.color }]}>
                  <Text style={[styles.myLevelBadgeText, { color: myLevelInfo.color }]}>
                    {myLevelInfo.icon} Level {myLevelInfo.level} • {getLocalizedLevelTitle(myLevelInfo.level)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Level Progress Bar: Keyingi darajagacha */}
          <View style={styles.levelProgressSection}>
            <View style={styles.levelProgressLabelRow}>
              <Text style={styles.levelProgressLabel}>
                {t('leaderboard_to_next_level', 'Keyingi darajagacha')}:
              </Text>
              <Text style={styles.levelProgressRemaining}>
                {myLevelInfo.isMaxLevel
                  ? 'Eng yuqori daraja! 🚀'
                  : `${myLevelInfo.wordsToNext} ${t('leaderboard_words_left', 'ta so\'z qoldi')} (${myLevelInfo.progressPercent}%)`}
              </Text>
            </View>
            <View style={styles.levelProgressTrack}>
              <View
                style={[
                  styles.levelProgressFill,
                  { width: `${myLevelInfo.progressPercent}%`, backgroundColor: myLevelInfo.color },
                ]}
              />
            </View>
          </View>

          {/* Kichik statistika paneli */}
          <View style={styles.myStatsRow}>
            <View style={styles.myStatCol}>
              <Text style={styles.myStatNum}>{currentUserEntry.totalWords || 0}</Text>
              <Text style={styles.myStatLbl}>{t('leaderboard_words_count', 'Jami So\'z')}</Text>
            </View>
            <View style={styles.myStatDivider} />
            <View style={styles.myStatCol}>
              <Text style={[styles.myStatNum, { color: '#0284C7' }]}>{currentUserEntry.bookWords || 0}</Text>
              <Text style={styles.myStatLbl}>Kitobdan</Text>
            </View>
            <View style={styles.myStatDivider} />
            <View style={styles.myStatCol}>
              <Text style={[styles.myStatNum, { color: '#059669' }]}>{currentUserEntry.customWords || 0}</Text>
              <Text style={styles.myStatLbl}>Lug'atimdan</Text>
            </View>
            <View style={styles.myStatDivider} />
            <View style={styles.myStatCol}>
              <Text style={[styles.myStatNum, { color: '#EA580C' }]}>🔥 {currentUserEntry.streak || 0}</Text>
              <Text style={styles.myStatLbl}>Streak</Text>
            </View>
          </View>
        </View>

        {/* 3. Filtr Tablari */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setFilterType('all')}
            style={[styles.filterTab, filterType === 'all' && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filterType === 'all' && styles.filterTabTextActive]}>
              {t('leaderboard_tab_all', '🏆 Barchasi')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setFilterType('books')}
            style={[styles.filterTab, filterType === 'books' && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filterType === 'books' && styles.filterTabTextActive]}>
              {t('leaderboard_tab_books', '📖 Kitob So\'zlari')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setFilterType('custom')}
            style={[styles.filterTab, filterType === 'custom' && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filterType === 'custom' && styles.filterTabTextActive]}>
              {t('leaderboard_tab_custom', '✍️ Shaxsiy Lug\'at')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. Top 3 Shohsupa (Podium: 2, 1, 3) */}
        {!loading && displayList.length >= 3 && (
          <View style={styles.podiumContainer}>
            {/* 2-o'rin (Kumush) */}
            {top2 && (
              <View style={[styles.podiumCol, styles.podiumCol2]}>
                <View style={styles.podiumMedalBox}>
                  <Text style={styles.podiumMedalEmoji}>🥈</Text>
                </View>
                <View style={[styles.podiumAvatarCircle, { borderColor: '#94A3B8' }]}>
                  <Text style={{ fontSize: 26 }}>{top2.avatar || '🥈'}</Text>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>{top2.name}</Text>
                <View style={styles.podiumLevelPill}>
                  <Text style={styles.podiumLevelText}>Lvl {top2.level}</Text>
                </View>
                <View style={[styles.podiumStep, styles.podiumStep2]}>
                  <Text style={styles.podiumRankNum}>#2</Text>
                  <Text style={styles.podiumWordsNum}>
                    {filterType === 'books' ? top2.bookWords : filterType === 'custom' ? top2.customWords : top2.totalWords}
                  </Text>
                  <Text style={styles.podiumWordsLabel}>{t('leaderboard_words_count', 'so\'z')}</Text>
                </View>
              </View>
            )}

            {/* 1-o'rin (Oltin) */}
            {top1 && (
              <View style={[styles.podiumCol, styles.podiumCol1]}>
                <View style={styles.podiumCrownBox}>
                  <Text style={{ fontSize: 22 }}>👑</Text>
                </View>
                <View style={[styles.podiumAvatarCircle, { borderColor: '#F59E0B', width: 68, height: 68 }]}>
                  <Text style={{ fontSize: 32 }}>{top1.avatar || '🥇'}</Text>
                </View>
                <Text style={[styles.podiumName, { fontWeight: '900', color: '#B45309' }]} numberOfLines={1}>
                  {top1.name}
                </Text>
                <View style={[styles.podiumLevelPill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <Text style={[styles.podiumLevelText, { color: '#B45309' }]}>Lvl {top1.level} • {top1.levelTitle}</Text>
                </View>
                <View style={[styles.podiumStep, styles.podiumStep1]}>
                  <Text style={styles.podiumRankNum1}>#1</Text>
                  <Text style={styles.podiumWordsNum1}>
                    {filterType === 'books' ? top1.bookWords : filterType === 'custom' ? top1.customWords : top1.totalWords}
                  </Text>
                  <Text style={styles.podiumWordsLabel1}>{t('leaderboard_words_count', 'so\'z')}</Text>
                </View>
              </View>
            )}

            {/* 3-o'rin (Bronza) */}
            {top3 && (
              <View style={[styles.podiumCol, styles.podiumCol3]}>
                <View style={styles.podiumMedalBox}>
                  <Text style={styles.podiumMedalEmoji}>🥉</Text>
                </View>
                <View style={[styles.podiumAvatarCircle, { borderColor: '#D97706' }]}>
                  <Text style={{ fontSize: 26 }}>{top3.avatar || '🥉'}</Text>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>{top3.name}</Text>
                <View style={styles.podiumLevelPill}>
                  <Text style={styles.podiumLevelText}>Lvl {top3.level}</Text>
                </View>
                <View style={[styles.podiumStep, styles.podiumStep3]}>
                  <Text style={styles.podiumRankNum}>#3</Text>
                  <Text style={styles.podiumWordsNum}>
                    {filterType === 'books' ? top3.bookWords : filterType === 'custom' ? top3.customWords : top3.totalWords}
                  </Text>
                  <Text style={styles.podiumWordsLabel}>{t('leaderboard_words_count', 'so\'z')}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 5. To'liq Ro'yxat */}
        <View style={styles.listSection}>
          <Text style={styles.listSectionTitle}>Barcha O'quvchilar Ro'yxati</Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
              <Text style={styles.loadingText}>Yuklanmoqda...</Text>
            </View>
          ) : (
            displayList.map((item) => {
              const cleanCur = String(user?.username || '').toLowerCase().replace(/^@/, '').trim();
              const isMe = String(item.username || '').toLowerCase().replace(/^@/, '').trim() === cleanCur;
              const countToShow = filterType === 'books' ? item.bookWords : filterType === 'custom' ? item.customWords : item.totalWords;

              return (
                <View
                  key={item.username || item.displayRank}
                  style={[
                    styles.userCard,
                    isMe && styles.userCardMe,
                    item.displayRank <= 3 && styles.userCardTopThree,
                  ]}
                >
                  {/* O'rin */}
                  <View style={styles.userCardRankBox}>
                    {item.displayRank === 1 ? (
                      <Text style={{ fontSize: 20 }}>🥇</Text>
                    ) : item.displayRank === 2 ? (
                      <Text style={{ fontSize: 20 }}>🥈</Text>
                    ) : item.displayRank === 3 ? (
                      <Text style={{ fontSize: 20 }}>🥉</Text>
                    ) : (
                      <Text style={[styles.userCardRankText, isMe && { color: colors.primary.DEFAULT }]}>
                        #{item.displayRank}
                      </Text>
                    )}
                  </View>

                  {/* Avatar */}
                  <View style={styles.userCardAvatarBox}>
                    <Text style={{ fontSize: 24 }}>{item.avatar || '👨‍🎓'}</Text>
                    {item.isPremium && (
                      <View style={styles.smallCrown}>
                        <Text style={{ fontSize: 8 }}>👑</Text>
                      </View>
                    )}
                  </View>

                  {/* Ism va Daraja */}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.userCardName, isMe && styles.userCardNameMe]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isMe && (
                        <View style={styles.meTag}>
                          <Text style={styles.meTagText}>Siz</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <View style={styles.userLevelBadge}>
                        <Text style={styles.userLevelBadgeText}>
                          {item.levelIcon || '🌱'} Lvl {item.level || 1} • {getLocalizedLevelTitle(item.level || 1)}
                        </Text>
                      </View>
                      {item.streak > 0 && (
                        <Text style={styles.userCardStreak}>🔥 {item.streak}</Text>
                      )}
                    </View>
                  </View>

                  {/* So'zlar va XP */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.userCardWordsCount}>
                      {countToShow || 0}
                    </Text>
                    <Text style={styles.userCardWordsUnit}>
                      {t('leaderboard_words_count', 'ta so\'z')}
                    </Text>
                    <Text style={styles.userCardXp}>
                      {Number(item.xp || 0).toLocaleString()} XP
                    </Text>
                  </View>
                </View>
              );
            })
          )}
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
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
    letterSpacing: 0.5,
  },
  headerDot: {
    color: '#94A3B8',
    fontSize: 10,
  },
  headerSubBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  // My Rank Card
  myRankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: colors.primary.DEFAULT + '33',
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  myRankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myRankAvatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: colors.primary.DEFAULT,
  },
  myRankAvatar: {
    fontSize: 28,
  },
  crownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  myRankName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  rankPill: {
    backgroundColor: colors.primary.DEFAULT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rankPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  myLevelPillRow: {
    marginTop: 4,
  },
  myLevelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  myLevelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Level progress
  levelProgressSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  levelProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelProgressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  levelProgressRemaining: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  levelProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Stats row inside card
  myStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  myStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  myStatNum: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  myStatLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  myStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },

  // Filter tabs
  filterTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    padding: 3,
    borderRadius: 14,
    marginBottom: 18,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: colors.primary.DEFAULT,
    fontWeight: '800',
  },

  // Podium
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 24,
    paddingTop: 16,
    paddingHorizontal: 6,
  },
  podiumCol: {
    alignItems: 'center',
    flex: 1,
  },
  podiumCol1: {
    zIndex: 3,
  },
  podiumCol2: {
    zIndex: 2,
  },
  podiumCol3: {
    zIndex: 1,
  },
  podiumCrownBox: {
    marginBottom: 2,
  },
  podiumMedalBox: {
    marginBottom: 4,
  },
  podiumMedalEmoji: {
    fontSize: 18,
  },
  podiumAvatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  podiumName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: (width - 64) / 3,
  },
  podiumLevelPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  podiumLevelText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  podiumStep: {
    width: '92%',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  podiumStep1: {
    height: 105,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  podiumStep2: {
    height: 82,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#94A3B8',
  },
  podiumStep3: {
    height: 68,
    backgroundColor: '#FFEDD5',
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  podiumRankNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#475569',
  },
  podiumRankNum1: {
    fontSize: 17,
    fontWeight: '900',
    color: '#B45309',
  },
  podiumWordsNum: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 2,
  },
  podiumWordsNum1: {
    fontSize: 18,
    fontWeight: '900',
    color: '#B45309',
    marginTop: 2,
  },
  podiumWordsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  podiumWordsLabel1: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },

  // List section
  listSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  userCardMe: {
    backgroundColor: '#EEF2FF',
    borderColor: colors.primary.DEFAULT,
    borderWidth: 1.5,
  },
  userCardTopThree: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  userCardRankBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCardRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  userCardAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginLeft: 6,
  },
  smallCrown: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 1,
  },
  userCardName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  userCardNameMe: {
    color: colors.primary.DEFAULT,
  },
  meTag: {
    backgroundColor: colors.primary.DEFAULT,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  meTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userLevelBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  userLevelBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
  },
  userCardStreak: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
  },
  userCardWordsCount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  userCardWordsUnit: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  userCardXp: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
    marginTop: 1,
  },
});
