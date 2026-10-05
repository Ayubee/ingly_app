/**
 * INGLY MOBILE - QUIZ SCREEN
 * 4000 Essential English Words - Dinamik Unit Testlari
 * Tanlangan Book va Unit bo'yicha 20 ta so'zdan avtomatik 4 variantli test hosil qiladi.
 * To'g'ri javob va tasodifiy noto'g'ri variantlar (distractors) real-time shakllanadi.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
  Modal,
} from 'react-native';
import { colors } from '../theme.js';
import allWordsData from '../data/all_words.json';
import { useUser } from '../context/UserContext.js';
import { useLanguage } from '../context/LanguageContext.js';

export default function QuizScreen({ onNavigate }) {
  const { user, recordQuizResult, setActiveLesson } = useUser();
  const { t } = useLanguage();
  const currentBook = user?.activeBook || 1;
  const currentUnit = user?.activeUnit || 1;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [isUnitSelectorVisible, setIsUnitSelectorVisible] = useState(false);

  // Faol kitob va unit bo'yicha 20 ta so'z
  const unitWords = useMemo(() => {
    const filtered = allWordsData.filter(
      (w) => Number(w.book) === Number(currentBook) && Number(w.unit) === Number(currentUnit)
    );
    return filtered.length > 0 ? filtered : allWordsData.slice(0, 20);
  }, [currentBook, currentUnit]);

  // Savollarni all_words.json dan dinamik generatsiya qilish
  const generatedQuestions = useMemo(() => {
    if (!unitWords || unitWords.length === 0) return [];

    // Noto'g'ri variantlar tanlash uchun umumiy baza
    const otherWords = allWordsData.filter(
      (w) => !(Number(w.book) === Number(currentBook) && Number(w.unit) === Number(currentUnit))
    );

    return unitWords.map((wordObj, index) => {
      const correctUzbek = wordObj.uzbek || 'Noma\'lum';

      // 3 ta tasodifiy boshqa o'zbekcha tarjimalarni tanlaymiz
      const distractors = [];
      const usedTranslations = new Set([correctUzbek]);

      // Boshqa so'zlarni aralashtiramiz
      const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());

      for (const item of shuffledOthers) {
        if (item.uzbek && !usedTranslations.has(item.uzbek)) {
          distractors.push(item.uzbek);
          usedTranslations.add(item.uzbek);
          if (distractors.length >= 3) break;
        }
      }

      // Agar yetarli distractor topilmasa, fallback variantlar
      while (distractors.length < 3) {
        distractors.push(`Variant ${distractors.length + 1}`);
      }

      // 4 ta variantni aralashtirish
      const rawOptions = [
        { text: correctUzbek, isCorrect: true },
        { text: distractors[0], isCorrect: false },
        { text: distractors[1], isCorrect: false },
        { text: distractors[2], isCorrect: false },
      ].sort(() => 0.5 - Math.random());

      const letterKeys = ['a', 'b', 'c', 'd'];
      const options = rawOptions.map((opt, i) => ({
        id: letterKeys[i],
        text: opt.text,
        isCorrect: opt.isCorrect,
      }));

      const wordTitle = (wordObj.word || '').charAt(0).toUpperCase() + (wordObj.word || '').slice(1);

      return {
        id: index + 1,
        word: wordTitle,
        phonetic: wordObj.ipa || wordObj.phonetic || '',
        pos: (wordObj.pos || 'Word').toUpperCase(),
        options,
      };
    });
  }, [unitWords, currentBook, currentUnit]);

  // Unit o'zgarganda testni boshidan boshlash
  useEffect(() => {
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setScore(0);
    setQuizFinished(false);
  }, [currentBook, currentUnit]);

  const totalQuestions = generatedQuestions.length;
  const safeIndex = totalQuestions > 0 ? Math.max(0, Math.min(currentQuestionIndex, totalQuestions - 1)) : 0;
  const question = totalQuestions > 0 ? generatedQuestions[safeIndex] : null;

  const handleSelectOption = (option) => {
    if (selectedOptionId) return;

    setSelectedOptionId(option.id);
    if (option.isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    setSelectedOptionId(null);
    if (safeIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(safeIndex + 1);
    } else {
      setQuizFinished(true);
      recordQuizResult(score, totalQuestions);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setScore(0);
    setQuizFinished(false);
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

  if (totalQuestions === 0 || !question) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📝</Text>
          <Text style={styles.emptyTitle}>Savollar ro'yxati mavjud emas</Text>
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

  const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const progressPercent = totalQuestions > 0 ? ((safeIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Unit Selector Header */}
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

          <TouchableOpacity
            style={styles.unitTitleBadge}
            activeOpacity={0.7}
            onPress={() => setIsUnitSelectorVisible(true)}
          >
            <Text style={styles.unitBadgeMain}>
              Book {currentBook} • Unit {currentUnit} Testi
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

        {/* Top Header - Symmetrical & Clean */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bilim Testi (20 savol)</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>
              Ball: {score}/{totalQuestions}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        {!quizFinished ? (
          <View style={styles.quizBox}>
            {/* Question Card */}
            <View style={styles.questionCard}>
              <Text style={styles.questionLabel}>
                Savol {safeIndex + 1} / {totalQuestions}
              </Text>
              <Text style={styles.targetWord}>{question.word}</Text>
              <Text style={styles.phoneticText}>{question.phonetic}</Text>
              <View style={styles.posBadge}>
                <Text style={styles.posText}>{question.pos}</Text>
              </View>
              <Text style={styles.promptText}>To'g'ri o'zbekcha tarjimasini tanlang:</Text>
            </View>

            {/* Options */}
            <View style={styles.optionsList}>
              {question.options.map((opt) => {
                let cardStyle = styles.defaultCard;
                let textStyle = styles.defaultText;
                let badgeStyle = styles.defaultLetterBadge;

                if (selectedOptionId) {
                  if (opt.isCorrect) {
                    cardStyle = styles.correctCard;
                    textStyle = styles.correctText;
                    badgeStyle = styles.correctLetterBadge;
                  } else if (selectedOptionId === opt.id) {
                    cardStyle = styles.wrongCard;
                    textStyle = styles.wrongText;
                    badgeStyle = styles.wrongLetterBadge;
                  }
                }

                return (
                  <TouchableOpacity
                    key={opt.id}
                    activeOpacity={0.8}
                    disabled={!!selectedOptionId}
                    onPress={() => handleSelectOption(opt)}
                    style={[styles.optionBase, cardStyle]}
                  >
                    <View style={[styles.letterBadge, badgeStyle]}>
                      <Text style={styles.letterText}>
                        {opt.id.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, textStyle]}>
                      {opt.text}
                    </Text>
                    {selectedOptionId && opt.isCorrect && (
                      <Text style={styles.checkIcon}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Next Button */}
            {selectedOptionId && (
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.8}
                onPress={handleNext}
              >
                <Text style={styles.actionBtnText}>
                  {safeIndex < totalQuestions - 1
                    ? t('quiz_next_question', 'Keyingi Savol ➔')
                    : t('quiz_view_result', "Natijani Ko'rish 🏆")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Quiz Results View */
          <View style={styles.resultCard}>
            <Text style={styles.trophyIcon}>{score >= 15 ? '🏆' : score >= 10 ? '🌟' : '🎯'}</Text>
            <Text style={styles.resultTitle}>
              {score === totalQuestions
                ? "A'lo Natija! 🌟"
                : score >= 15
                ? "Ajoyib Natija! 👍"
                : score >= 10
                ? "Yaxshi Natija! 👏"
                : "Yana Mashq Qiling! 💡"}
            </Text>
            <Text style={styles.resultSubtitle}>
              Unit {currentUnit}: {totalQuestions} ta savoldan {score} tasiga to'g'ri javob berdingiz
            </Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{accuracy}%</Text>
                <Text style={styles.statDesc}>{t('quiz_accuracy_label', 'Aniqlik')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>+{score * 10} XP</Text>
                <Text style={styles.statDesc}>{t('quiz_xp_label', 'Tajriba bali')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>
                  {score > 0 ? '🔥 Faol' : '⚡ 0'}
                </Text>
                <Text style={styles.statDesc}>
                  {score > 0 ? 'Kunlik streak' : 'Streak uchun'}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.85}
              onPress={handleRestart}
            >
              <Text style={styles.actionBtnText}>{t('quiz_restart', 'Testni Qayta Topshirish 🔄')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flashcardsBtn}
              activeOpacity={0.8}
              onPress={() => onNavigate && onNavigate('Flashcards')}
            >
              <Text style={styles.flashcardsBtnText}>🎴 {t('quiz_back_to_cards', 'Unit Kartochkalariga Qaytish')}</Text>
            </TouchableOpacity>

            {currentUnit < 30 && (
              <TouchableOpacity
                style={styles.nextUnitBtn}
                activeOpacity={0.8}
                onPress={handleNextUnit}
              >
                <Text style={styles.nextUnitBtnText}>
                  Keyingi Unit (Unit {currentUnit + 1}) Testi ➔
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.homeBtn}
              activeOpacity={0.8}
              onPress={() => onNavigate && onNavigate('Home')}
            >
              <Text style={styles.homeBtnText}>{t('quiz_back_to_home', 'Bosh Sahifaga Qaytish')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Unit Selector Modal */}
      <Modal
        visible={isUnitSelectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsUnitSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book {currentBook} - Test Unitini Tanlash</Text>
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
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 36,
    alignItems: 'center',
  },
  unitNavBar: {
    width: '100%',
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
    paddingHorizontal: 8,
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
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  scoreBadge: {
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 9999,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 9999,
  },
  quizBox: {
    width: '100%',
    gap: 14,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  targetWord: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary.DEFAULT,
    marginBottom: 4,
  },
  phoneticText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  posBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  posText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  promptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  optionsList: {
    gap: 10,
  },
  optionBase: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  defaultCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  correctCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  wrongCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  letterBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  defaultLetterBadge: {
    backgroundColor: '#F1F5F9',
  },
  correctLetterBadge: {
    backgroundColor: '#22C55E',
  },
  wrongLetterBadge: {
    backgroundColor: '#EF4444',
  },
  letterText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  optionText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '600',
  },
  defaultText: {
    color: '#1E293B',
  },
  correctText: {
    color: '#15803D',
    fontWeight: '800',
  },
  wrongText: {
    color: '#B91C1C',
    fontWeight: '800',
  },
  checkIcon: {
    fontSize: 18,
    color: '#15803D',
    fontWeight: '900',
  },
  actionBtn: {
    width: '100%',
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  trophyIcon: {
    fontSize: 54,
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary.DEFAULT,
  },
  statDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '600',
  },
  flashcardsBtn: {
    width: '100%',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: 10,
  },
  flashcardsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  nextUnitBtn: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 10,
  },
  nextUnitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16A34A',
  },
  homeBtn: {
    marginTop: 14,
    paddingVertical: 8,
  },
  homeBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
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
