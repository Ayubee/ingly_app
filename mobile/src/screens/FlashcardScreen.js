/**
 * INGLY MOBILE - FLASHCARD SCREEN
 * 4000 Essential English Words - Dinamik 20 talik Unitlar tizimi
 * Har bir Unitda 20 ta to'liq so'z, transkripsiya, kino konteksti,
 * talaffuz va SRS (Spaced Repetition) takrorlash tizimi.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Modal,
} from 'react-native';
import { colors, srsModes } from '../theme.js';
import MovieClipModal from '../components/MovieClipModal.js';
import allWordsData from '../data/all_words.json';
import { useUser } from '../context/UserContext.js';

const { width } = Dimensions.get('window');

// Default fallback illustration image
const DEFAULT_CARD_IMAGE = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&q=80';

export default function FlashcardScreen({ onNavigate }) {
  const { user, recordWordLearned, setActiveLesson } = useUser();
  const currentBook = user?.activeBook || 1;
  const currentUnit = user?.activeUnit || 1;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isClipModalVisible, setIsClipModalVisible] = useState(false);
  const [isUnitSelectorVisible, setIsUnitSelectorVisible] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [isUnitFinished, setIsUnitFinished] = useState(false);

  // Faol kitob va unit bo'yicha so'zlarni filterlash (har unitda 20 ta so'z)
  const currentUnitWords = useMemo(() => {
    const filtered = allWordsData.filter(
      (w) => Number(w.book) === Number(currentBook) && Number(w.unit) === Number(currentUnit)
    );
    return filtered.length > 0 ? filtered : allWordsData.slice(0, 20);
  }, [currentBook, currentUnit]);

  // Unit o'zgarganda indeksni 0 ga tushirish
  useEffect(() => {
    setCurrentIndex(0);
    setIsUnitFinished(false);
  }, [currentBook, currentUnit]);

  const totalWords = currentUnitWords.length;
  const safeIndex = totalWords > 0 ? Math.max(0, Math.min(currentIndex, totalWords - 1)) : 0;
  const rawWord = totalWords > 0 ? currentUnitWords[safeIndex] : null;

  // So'z ma'lumotlarini to'liq formatlash
  const currentWord = useMemo(() => {
    if (!rawWord) return null;
    const wordStr = rawWord.word || '';
    const exampleStr = rawWord.exam || rawWord.example || rawWord.desc || '';
    const lowerEx = exampleStr.toLowerCase();
    const lowerW = wordStr.toLowerCase();
    const matchIdx = lowerEx.indexOf(lowerW);

    let examplePrefix = exampleStr;
    let exampleTargetWord = '';
    let exampleSuffix = '';
    if (matchIdx !== -1) {
      examplePrefix = exampleStr.substring(0, matchIdx);
      exampleTargetWord = exampleStr.substring(matchIdx, matchIdx + wordStr.length);
      exampleSuffix = exampleStr.substring(matchIdx + wordStr.length);
    }

    return {
      id: rawWord.id || safeIndex + 1,
      book: rawWord.book || currentBook,
      unit: rawWord.unit || currentUnit,
      unitTitle: `Book ${rawWord.book || currentBook} • Unit ${rawWord.unit || currentUnit}`,
      wordIndex: safeIndex + 1,
      totalWordsInUnit: totalWords,
      word: wordStr.charAt(0).toUpperCase() + wordStr.slice(1),
      phonetic: rawWord.ipa || rawWord.phonetic || '',
      pos: (rawWord.pos || 'noun').toUpperCase(),
      imageUrl: rawWord.imageUrl || DEFAULT_CARD_IMAGE,
      definition: rawWord.desc || rawWord.definition || '',
      uzbek: rawWord.uzbek || '',
      examplePrefix,
      exampleTargetWord,
      exampleSuffix,
      movieTitle: rawWord.movie || 'Cinema Context',
      movieQuote: rawWord.clip || `"${wordStr}" kontekstda`,
      movieYear: '2024',
      videoClipUrl: rawWord.video_clip_url || rawWord.videoUrl || null,
      stats: {
        hardPercent: 20,
        reviewPercent: 35,
        masteredPercent: 45,
      },
    };
  }, [rawWord, safeIndex, totalWords, currentBook, currentUnit]);

  const handlePlayAudio = (lang = 'en') => {
    if (!currentWord) return;
    setAudioPlaying(true);
    setFeedbackMessage(
      lang === 'en'
        ? `Talaffuz: "${currentWord.word}"`
        : `O'zbekcha: "${currentWord.uzbek}"`
    );
    setTimeout(() => {
      setAudioPlaying(false);
      setFeedbackMessage(null);
    }, 1500);
  };

  const handleSelectSRS = (mode) => {
    if (!currentWord || feedbackMessage) return;

    const modeLabel =
      mode === 'hard'
        ? 'Qiyin (Oraliq qisqartirildi)'
        : mode === 'review'
        ? 'Ertaga takrorlashga qo\'yildi'
        : 'Yodlandi! (Keyingi oraliq 4 kun)';

    setFeedbackMessage(modeLabel);
    recordWordLearned(currentWord.id, mode);

    setTimeout(() => {
      setFeedbackMessage(null);
      if (safeIndex < totalWords - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Unit yakunlandi!
        setIsUnitFinished(true);
      }
    }, 800);
  };

  const handlePrevUnit = () => {
    if (currentUnit > 1 && setActiveLesson) {
      setActiveLesson(currentBook, currentUnit - 1);
    }
  };

  const handleNextUnit = () => {
    if (currentUnit < 30 && setActiveLesson) {
      setActiveLesson(currentBook, currentUnit + 1);
    }
  };

  const handleSelectUnitFromModal = (unitNum) => {
    if (setActiveLesson) {
      setActiveLesson(currentBook, unitNum);
    }
    setIsUnitSelectorVisible(false);
  };

  // Agar unit yakunlangan bo'lsa, maxsus tabriklash kartochkasi
  if (isUnitFinished) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.finishedContainer}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.finishedTitle}>Unit {currentUnit} Yakunlandi!</Text>
          <Text style={styles.finishedSubtitle}>
            Siz ushbu unitdagi barcha {totalWords} ta so'zni muvaffaqiyatli ko'rib chiqdingiz.
          </Text>

          <View style={styles.finishedStatsBox}>
            <View style={styles.finishedStatItem}>
              <Text style={styles.finishedStatVal}>{totalWords}</Text>
              <Text style={styles.finishedStatLbl}>So'zlar</Text>
            </View>
            <View style={styles.finishedStatDivider} />
            <View style={styles.finishedStatItem}>
              <Text style={[styles.finishedStatVal, { color: '#22C55E' }]}>100%</Text>
              <Text style={styles.finishedStatLbl}>Bajarildi</Text>
            </View>
            <View style={styles.finishedStatDivider} />
            <View style={styles.finishedStatItem}>
              <Text style={[styles.finishedStatVal, { color: '#5B4DFF' }]}>Book {currentBook}</Text>
              <Text style={styles.finishedStatLbl}>Kitob</Text>
            </View>
          </View>

          {/* Action 1: Test topshirish */}
          <TouchableOpacity
            style={styles.quizActionBtn}
            activeOpacity={0.8}
            onPress={() => onNavigate && onNavigate('Quiz')}
          >
            <Text style={styles.quizActionBtnIcon}>📝</Text>
            <Text style={styles.quizActionBtnText}>Bilimni Sinash (Quiz Test)</Text>
          </TouchableOpacity>

          {/* Action 2: Keyingi Unit */}
          {currentUnit < 30 && (
            <TouchableOpacity
              style={styles.nextUnitActionBtn}
              activeOpacity={0.8}
              onPress={handleNextUnit}
            >
              <Text style={styles.nextUnitActionText}>
                Keyingi Unit (Unit {currentUnit + 1}) ➔
              </Text>
            </TouchableOpacity>
          )}

          {/* Action 3: Qaytadan takrorlash */}
          <TouchableOpacity
            style={styles.repeatActionBtn}
            activeOpacity={0.8}
            onPress={() => {
              setCurrentIndex(0);
              setIsUnitFinished(false);
            }}
          >
            <Text style={styles.repeatActionText}>🔄 Qaytadan takrorlash</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentWord || totalWords === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📚</Text>
          <Text style={styles.emptyTitle}>Hozircha so'zlar ro'yxati mavjud emas</Text>
          <TouchableOpacity
            style={styles.backHomeBtn}
            onPress={() => onNavigate && onNavigate('Home')}
          >
            <Text style={{ color: '#FFF', fontWeight: '700' }}>Bosh sahifaga qaytish</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent = Math.min(100, Math.round(((safeIndex + 1) / totalWords) * 100));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Unit Selector Header Bar */}
        <View style={styles.unitNavBar}>
          <TouchableOpacity
            onPress={handlePrevUnit}
            disabled={currentUnit <= 1}
            style={[styles.unitNavBtn, currentUnit <= 1 && styles.unitNavBtnDisabled]}
          >
            <Text style={[styles.unitNavBtnText, currentUnit <= 1 && styles.unitNavBtnTextDisabled]}>
              ◀ Oldingi
            </Text>
          </TouchableOpacity>

          {/* Clickable Unit Title with Modal Trigger */}
          <TouchableOpacity
            style={styles.unitTitleBadge}
            activeOpacity={0.7}
            onPress={() => setIsUnitSelectorVisible(true)}
          >
            <Text style={styles.unitBadgeMain}>
              Book {currentBook} • Unit {currentUnit}
            </Text>
            <Text style={styles.unitBadgeSub}>Unitni almashtirish ▾</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNextUnit}
            disabled={currentUnit >= 30}
            style={[styles.unitNavBtn, currentUnit >= 30 && styles.unitNavBtnDisabled]}
          >
            <Text style={[styles.unitNavBtnText, currentUnit >= 30 && styles.unitNavBtnTextDisabled]}>
              Keyingi ▶
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Top Unit & Progress Info */}
        <View style={styles.topInfoContainer}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressCounterText}>
              So'z: {safeIndex + 1} / {totalWords}
            </Text>
            <Text style={styles.progressPercentBadge}>{progressPercent}%</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* 3. Main Flashcard Container */}
        <View style={styles.cardContainer}>
          {/* Header Row: Word Title and Speaker Icon */}
          <View style={styles.cardHeaderRow}>
            <Text style={styles.wordHeading}>{currentWord.word}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handlePlayAudio('en')}
              style={styles.speakerButton}
            >
              <Text style={styles.speakerIcon}>🔊</Text>
            </TouchableOpacity>
          </View>

          {/* Subtitle Row: IPA and POS Badge */}
          <View style={styles.phoneticRow}>
            <Text style={styles.phoneticText}>{currentWord.phonetic}</Text>
            <View style={styles.posBadge}>
              <Text style={styles.posBadgeText}>{currentWord.pos}</Text>
            </View>
          </View>

          {/* Illustration Image */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: currentWord.imageUrl }}
              style={styles.illustrationImage}
              resizeMode="cover"
            />
          </View>

          {/* English Definition */}
          <Text style={styles.definitionText}>{currentWord.definition}</Text>

          {/* Uzbek Translation Row with Speaker */}
          <View style={styles.uzbekRow}>
            <Text style={styles.uzbekText}>{currentWord.uzbek}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handlePlayAudio('uz')}
              style={styles.uzbekSpeakerBtn}
            >
              <Text style={styles.uzbekSpeakerIcon}>🔊</Text>
            </TouchableOpacity>
          </View>

          {/* Thin Divider */}
          <View style={styles.cardDivider} />

          {/* Example Sentence with highlighted target word */}
          <View style={styles.exampleSentenceBox}>
            <Text style={styles.exampleSentenceText}>
              {currentWord.examplePrefix}
              <Text style={styles.highlightedWord}>
                {currentWord.exampleTargetWord || currentWord.word}
              </Text>
              {currentWord.exampleSuffix}
            </Text>
          </View>

          {/* Movie Context Button (3-5 soniyalik video lavha / iqtibos) */}
          <TouchableOpacity
            style={styles.movieClipButton}
            activeOpacity={0.8}
            onPress={() => setIsClipModalVisible(true)}
          >
            <Text style={styles.movieClipEmoji}>🎬</Text>
            <Text style={styles.movieClipText}>
              Kino kontekstini ko'rish ({currentWord.movieTitle})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Feedback Alert Toast */}
        {feedbackMessage && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{feedbackMessage}</Text>
          </View>
        )}

        {/* 4. Spaced Repetition (SRS) Action Buttons Row */}
        <View style={styles.srsContainer}>
          {/* Hard Button (Qiyin) */}
          <View style={styles.srsCol}>
            <TouchableOpacity
              style={[styles.srsButton, styles.srsHardBtn]}
              activeOpacity={0.8}
              onPress={() => handleSelectSRS('hard')}
            >
              <Text style={styles.srsHardIcon}>✕</Text>
              <Text style={styles.srsHardLabel}>Qiyin</Text>
            </TouchableOpacity>
            <Text style={styles.srsPercentText}>
              {currentWord?.stats?.hardPercent ?? 20}%
            </Text>
          </View>

          {/* Review Button (Takrorlash) */}
          <View style={styles.srsCol}>
            <TouchableOpacity
              style={[styles.srsButton, styles.srsReviewBtn]}
              activeOpacity={0.8}
              onPress={() => handleSelectSRS('review')}
            >
              <Text style={styles.srsReviewIcon}>↻</Text>
              <Text style={styles.srsReviewLabel}>Takrorlash</Text>
            </TouchableOpacity>
            <Text style={styles.srsPercentText}>
              {currentWord?.stats?.reviewPercent ?? 35}%
            </Text>
          </View>

          {/* Mastered Button (Yodlandi) */}
          <View style={styles.srsCol}>
            <TouchableOpacity
              style={[styles.srsButton, styles.srsMasteredBtn]}
              activeOpacity={0.8}
              onPress={() => handleSelectSRS('mastered')}
            >
              <Text style={styles.srsMasteredIcon}>✓</Text>
              <Text style={styles.srsMasteredLabel}>Yodlandi</Text>
            </TouchableOpacity>
            <Text style={styles.srsPercentText}>
              {currentWord?.stats?.masteredPercent ?? 45}%
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Movie Clip Modal */}
      <MovieClipModal
        visible={isClipModalVisible}
        onClose={() => setIsClipModalVisible(false)}
        wordData={currentWord}
      />

      {/* Quick Unit Selector Modal (1 to 30) */}
      <Modal
        visible={isUnitSelectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsUnitSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book {currentBook} - Unit Tanlash</Text>
              <TouchableOpacity
                onPress={() => setIsUnitSelectorVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.unitGridModal}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((uNum) => {
                const isSelected = uNum === currentUnit;
                return (
                  <TouchableOpacity
                    key={uNum}
                    style={[styles.unitModalItem, isSelected && styles.unitModalItemActive]}
                    onPress={() => handleSelectUnitFromModal(uNum)}
                  >
                    <Text style={[styles.unitModalItemText, isSelected && styles.unitModalItemTextActive]}>
                      Unit {uNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F8',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  unitNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitNavBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  unitNavBtnDisabled: {
    backgroundColor: '#F1F5F9',
  },
  unitNavBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  unitNavBtnTextDisabled: {
    color: '#94A3B8',
  },
  unitTitleBadge: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  unitBadgeMain: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitBadgeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
    marginTop: 2,
  },
  topInfoContainer: {
    marginBottom: 14,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCounterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  progressPercentBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6366F1',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5B4DFF',
    borderRadius: 9999,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  wordHeading: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  speakerButton: {
    position: 'absolute',
    right: 0,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerIcon: {
    fontSize: 20,
  },
  phoneticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  phoneticText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  posBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  posBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  imageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  definitionText: {
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 12,
  },
  uzbekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  uzbekText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0284C7',
  },
  uzbekSpeakerBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uzbekSpeakerIcon: {
    fontSize: 16,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  exampleSentenceBox: {
    marginBottom: 14,
  },
  exampleSentenceText: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 21,
  },
  highlightedWord: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    fontWeight: '700',
  },
  movieClipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    gap: 6,
    marginTop: 4,
  },
  movieClipEmoji: {
    fontSize: 15,
  },
  movieClipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B4DFF',
  },
  toastContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginBottom: 14,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  srsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  srsCol: {
    flex: 1,
    alignItems: 'center',
  },
  srsButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
  },
  srsHardBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  srsHardIcon: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '900',
  },
  srsHardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  srsReviewBtn: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  srsReviewIcon: {
    fontSize: 16,
    color: '#0284C7',
    fontWeight: '900',
  },
  srsReviewLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  srsMasteredBtn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  srsMasteredIcon: {
    fontSize: 16,
    color: '#16A34A',
    fontWeight: '900',
  },
  srsMasteredLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
  },
  srsPercentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },
  finishedContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  celebrationEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  finishedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  finishedSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  finishedStatsBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  finishedStatItem: {
    alignItems: 'center',
  },
  finishedStatVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  finishedStatLbl: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  finishedStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#CBD5E1',
  },
  quizActionBtn: {
    backgroundColor: '#5B4DFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 10,
  },
  quizActionBtnIcon: {
    fontSize: 16,
  },
  quizActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  nextUnitActionBtn: {
    backgroundColor: '#F5F3FF',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 10,
  },
  nextUnitActionText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
  },
  repeatActionBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  repeatActionText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '700',
  },
  unitGridModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  unitModalItem: {
    width: '30%',
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitModalItemActive: {
    backgroundColor: '#5B4DFF',
    borderColor: '#5B4DFF',
  },
  unitModalItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  unitModalItemTextActive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  backHomeBtn: {
    backgroundColor: '#5B4DFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
});
