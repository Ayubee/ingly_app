/**
 * INGLY MOBILE - FLASHCARD SCREEN
 * assets/ui_flashcard.jpg dizayn maketiga 100% mos ravishda yaratildi.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { colors, srsModes } from '../theme.js';
import MovieClipModal from '../components/MovieClipModal.js';
import { flashcardWords } from '../data/sampleData.js';
import { useUser } from '../context/UserContext.js';

const { width } = Dimensions.get('window');

export default function FlashcardScreen({ onNavigate }) {
  const { recordWordLearned } = useUser();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isClipModalVisible, setIsClipModalVisible] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const totalWords = flashcardWords && Array.isArray(flashcardWords) ? flashcardWords.length : 0;
  const safeIndex = totalWords > 0 ? Math.max(0, Math.min(currentIndex, totalWords - 1)) : 0;
  const currentWord = totalWords > 0 ? flashcardWords[safeIndex] : null;

  if (!currentWord || totalWords === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📚</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>
            Hozircha so'zlar ro'yxati mavjud emas
          </Text>
          <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 }}>
            Ushbu bo'lim uchun so'zlar tez orada yuklanadi.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary.DEFAULT, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => onNavigate && onNavigate('Home')}
          >
            <Text style={{ color: '#FFF', fontWeight: '700' }}>Bosh sahifaga qaytish</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handlePlayAudio = (lang = 'en') => {
    if (!currentWord) return;
    setAudioPlaying(true);
    setFeedbackMessage(
      lang === 'en'
        ? `Talaffuz: "${currentWord.word || ''}"`
        : `O'zbekcha: "${currentWord.uzbek || ''}"`
    );
    setTimeout(() => {
      setAudioPlaying(false);
      setFeedbackMessage(null);
    }, 1500);
  };

  const handleSelectSRS = (mode) => {
    if (!currentWord || feedbackMessage) return; // Chekka holat: tez-tez bosganda dubl bo'lishini oldini olish

    const modeLabel =
      mode === 'hard'
        ? 'Qiyin (Oraliq qisqartirildi)'
        : mode === 'review'
        ? 'Ertaga takrorlashga qo\'yildi'
        : 'Yodlandi! (Keyingi oraliq 4 kun)';

    setFeedbackMessage(modeLabel);
    recordWordLearned(currentWord.id || 1, mode);

    setTimeout(() => {
      setFeedbackMessage(null);
      // Next card boundary-safe logic (indeksdan chiqib ketmaslik)
      setCurrentIndex((prev) => {
        if (prev < totalWords - 1) {
          return prev + 1;
        } else {
          return 0; // Ro'yxat tugaganda boshidan takrorlash
        }
      });
    }, 1000);
  };

  const totalInUnit = currentWord.totalWordsInUnit || 20;
  const progressPercent = totalInUnit > 0
    ? Math.min(100, Math.round(((currentWord.wordIndex || 1) / totalInUnit) * 100))
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Top Unit & Progress Info */}
        <View style={styles.topInfoContainer}>
          <Text style={styles.progressCounterText}>
            {currentWord.unitTitle}: ({currentWord.wordIndex}/{currentWord.totalWordsInUnit})
          </Text>

          {/* Progress Bar (75% filled purple/indigo gradient) */}
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>

          {/* Unit Title */}
          <Text style={styles.unitMainHeading}>{currentWord.unitTitle}</Text>
        </View>

        {/* 2. Main Flashcard Container */}
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

          {/* Example Sentence with highlighted target word pill */}
          <View style={styles.exampleSentenceBox}>
            <Text style={styles.exampleSentenceText}>
              {currentWord.examplePrefix}
              <Text style={styles.highlightedWord}>
                {currentWord.exampleTargetWord}
              </Text>
              {currentWord.exampleSuffix}
            </Text>
          </View>

          {/* Movie Context Button (TZ.txt 4.4 - 3-5 soniyalik video lavha) */}
          <TouchableOpacity
            style={styles.movieClipButton}
            activeOpacity={0.8}
            onPress={() => setIsClipModalVisible(true)}
          >
            <Text style={styles.movieClipEmoji}>🎬</Text>
            <Text style={styles.movieClipText}>
              Kino kontekstini ko'rish (3s lavha)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Feedback Alert Toast */}
        {feedbackMessage && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{feedbackMessage}</Text>
          </View>
        )}

        {/* 3. Spaced Repetition (SRS) Action Buttons Row */}
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
              {currentWord?.stats?.hardPercent ?? 25}%
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
              {currentWord?.stats?.masteredPercent ?? 40}%
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
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
  },
  topInfoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  progressCounterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 9999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5B4DFF',
    borderRadius: 9999,
  },
  unitMainHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  wordHeading: {
    fontSize: 32,
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
    marginBottom: 16,
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
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  imageContainer: {
    width: '100%',
    height: 190,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 18,
    backgroundColor: '#F8FAFC',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  definitionText: {
    fontSize: 16,
    color: '#0F172A',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 14,
  },
  uzbekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  uzbekText: {
    fontSize: 22,
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
    fontSize: 17,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },
  exampleSentenceBox: {
    marginBottom: 14,
  },
  exampleSentenceText: {
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 22,
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
    borderRadius: 14,
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
    gap: 12,
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
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  srsPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },
});
