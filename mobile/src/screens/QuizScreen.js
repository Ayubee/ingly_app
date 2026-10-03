/**
 * INGLY MOBILE - QUIZ SCREEN
 * Interaktiv 4 variantli test, markazlashtirilgan chiroyli natijalar
 * va haqiqiy natijalarni saqlash.
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
import { colors } from '../theme.js';
import { quizQuestions } from '../data/sampleData.js';
import { useUser } from '../context/UserContext.js';

export default function QuizScreen({ onNavigate }) {
  const { recordQuizResult } = useUser();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const totalQuestions = quizQuestions && Array.isArray(quizQuestions) ? quizQuestions.length : 0;
  const safeIndex = totalQuestions > 0 ? Math.max(0, Math.min(currentQuestionIndex, totalQuestions - 1)) : 0;
  const question = totalQuestions > 0 ? quizQuestions[safeIndex] : null;

  if (totalQuestions === 0 || !question) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📝</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>
            Savollar ro'yxati mavjud emas
          </Text>
          <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 }}>
            Ushbu unit uchun test savollari tez kunda yuklanadi.
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

  const handleSelectOption = (option) => {
    if (selectedOptionId) return; // Prevent double click

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

  const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header - Symmetrical & Clean */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Unit 1 • Bilim Testi</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>
              Ball: {score}/{totalQuestions}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${totalQuestions > 0 ? ((safeIndex + 1) / totalQuestions) * 100 : 0}%`,
              },
            ]}
          />
        </View>

        {!quizFinished ? (
          <View style={styles.quizBox}>
            {/* Question Card */}
            <View style={styles.questionCard}>
              <Text style={styles.questionLabel}>
                Savol {safeIndex + 1} / {totalQuestions}
              </Text>
              <Text style={styles.targetWord}>{question.word || ''}</Text>
              <Text style={styles.phoneticText}>{question.phonetic || ''}</Text>
              <View style={styles.posBadge}>
                <Text style={styles.posText}>{question.pos || 'Word'}</Text>
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
                  {currentQuestionIndex < quizQuestions.length - 1
                    ? 'Keyingi Savol ➔'
                    : 'Natijani Ko\'rish 🏆'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Quiz Results View - To'liq markazlashtirilgan va proporsional */
          <View style={styles.resultCard}>
            <Text style={styles.trophyIcon}>{score > 0 ? '🏆' : '🎯'}</Text>
            <Text style={styles.resultTitle}>
              {score === quizQuestions.length
                ? "A'lo Natija! 🌟"
                : score > 0
                ? "Yaxshi Urinish! 👍"
                : "Mashq qiling! 💡"}
            </Text>
            <Text style={styles.resultSubtitle}>
              Siz {quizQuestions.length} ta savoldan {score} tasiga to'g'ri javob berdingiz
            </Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{accuracy}%</Text>
                <Text style={styles.statDesc}>Aniqlik</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>+{score * 10} XP</Text>
                <Text style={styles.statDesc}>Tajriba bali</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>
                  {score > 0 ? '🔥 +1 kun' : '⚡ 0'}
                </Text>
                <Text style={styles.statDesc}>
                  {score > 0 ? 'Streak oshdi' : 'Streak uchun'}
                </Text>
              </View>
            </View>

            {/* Action Buttons - To'liq eni bo'yicha qulay */}
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.85}
              onPress={handleRestart}
            >
              <Text style={styles.actionBtnText}>Qayta Sinash 🔄</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeBtn}
              activeOpacity={0.8}
              onPress={() => onNavigate && onNavigate('Home')}
            >
              <Text style={styles.homeBtnText}>Bosh Sahifaga Qaytish</Text>
            </TouchableOpacity>
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
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    marginBottom: 20,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 9999,
  },
  quizBox: {
    width: '100%',
    gap: 16,
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
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  posBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 14,
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
  homeBtn: {
    marginTop: 12,
    paddingVertical: 10,
  },
  homeBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
});
