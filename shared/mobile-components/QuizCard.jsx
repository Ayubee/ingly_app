/**
 * INGLY MOBILE DESIGN SYSTEM - QUIZ CARD COMPONENT (React Native)
 * TZ.txt 4.3 bo'limidagi 4 variantli interaktiv test kartochkasi.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../theme.js';

const { width } = Dimensions.get('window');

export default function QuizCard({
  question = 'Afraid',
  phonetic = '/əˈfreɪd/',
  options = [
    { id: 'a', text: "Qo'rqqan", isCorrect: true },
    { id: 'b', text: "Jahli chiqqan", isCorrect: false },
    { id: 'c', text: "Rozi bo'lmoq", isCorrect: false },
    { id: 'd', text: "Yetib kelmoq", isCorrect: false },
  ],
  onAnswer,
}) {
  const [selectedId, setSelectedId] = useState(null);

  const handleSelect = (option) => {
    if (selectedId) return; // Allaqachon tanlangan bo'lsa
    setSelectedId(option.id);
    if (onAnswer) onAnswer(option.isCorrect);
  };

  return (
    <View style={styles.container}>
      {/* Question Header */}
      <View style={styles.questionBox}>
        <Text style={styles.subtitle}>To'g'ri tarjimani tanlang:</Text>
        <Text style={styles.questionText}>{question}</Text>
        {phonetic ? <Text style={styles.phoneticText}>{phonetic}</Text> : null}
      </View>

      {/* 4 Variant Buttons */}
      <View style={styles.optionsList}>
        {options.map((opt) => {
          let btnStyle = styles.defaultOption;
          let textStyle = styles.defaultOptionText;

          if (selectedId) {
            if (opt.isCorrect) {
              btnStyle = styles.correctOption;
              textStyle = styles.correctOptionText;
            } else if (selectedId === opt.id) {
              btnStyle = styles.wrongOption;
              textStyle = styles.wrongOptionText;
            }
          }

          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.8}
              disabled={!!selectedId}
              onPress={() => handleSelect(opt)}
              style={[styles.optionBase, btnStyle]}
            >
              <View style={styles.optLetterBox}>
                <Text style={styles.optLetter}>{opt.id.toUpperCase()}</Text>
              </View>
              <Text style={[styles.optText, textStyle]}>{opt.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: width - 40,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    elevation: 3,
    alignSelf: 'center',
  },
  questionBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
  },
  phoneticText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
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
  defaultOption: {
    backgroundColor: colors.surface.secondary,
    borderColor: colors.border.DEFAULT,
  },
  defaultOptionText: {
    color: colors.text.primary,
  },
  correctOption: {
    backgroundColor: colors.status.masteredBg,
    borderColor: colors.status.mastered,
  },
  correctOptionText: {
    color: colors.status.mastered,
    fontWeight: '700',
  },
  wrongOption: {
    backgroundColor: colors.status.hardBg,
    borderColor: colors.status.hard,
  },
  wrongOptionText: {
    color: colors.status.hard,
    fontWeight: '700',
  },
  optLetterBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optLetter: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  optText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
