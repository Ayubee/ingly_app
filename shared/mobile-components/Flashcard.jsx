/**
 * INGLY MOBILE DESIGN SYSTEM - FLASHCARD COMPONENT (React Native)
 * TZ.txt 4.2 bo'limi talablariga mos oraliq takrorlash (SRS) kartochkasi.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { colors, srsModes } from '../theme.js';

const { width } = Dimensions.get('window');

export default function Flashcard({
  word = 'Afraid',
  phonetic = '/əˈfreɪd/',
  pos = 'adjective',
  uzbek = "Qo'rqqan",
  definition = 'When someone is afraid, they feel fear.',
  definitionUz = 'Biror kimsa qo\'rqqanda, u xavf yoki vahimani his qiladi.',
  example = 'The woman was afraid of what she saw.',
  exampleUz = 'Ayol ko\'rgan narsasidan qo\'rqib ketdi.',
  imageUrl,
  onPlayAudio,
  onSelectSRS, // (mode: 'hard' | 'review' | 'mastered') => void
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <View style={styles.cardContainer}>
      {/* Yuqori qism: So'z va Transkripsiya */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pos.toUpperCase()}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPlayAudio}
          style={styles.audioButton}
        >
          <Text style={styles.audioIcon}>🔊</Text>
        </TouchableOpacity>
      </View>

      {/* Rasm yoki Illyustratsiya */}
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.wordImage}
          resizeMode="cover"
        />
      )}

      {/* So'z va IPA */}
      <View style={styles.wordBox}>
        <Text style={styles.wordTitle}>{word}</Text>
        <Text style={styles.phoneticText}>{phonetic}</Text>
      </View>

      {/* Tarjima va Misol (Kartochka orqasi / Ochilgandagi ko'rinish) */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setIsFlipped(!isFlipped)}
        style={styles.flipArea}
      >
        {!isFlipped ? (
          <View style={styles.tapToReveal}>
            <Text style={styles.tapText}>👆 Tarjimani ko'rish uchun bosing</Text>
          </View>
        ) : (
          <View style={styles.translationBox}>
            <Text style={styles.uzbekText}>{uzbek}</Text>
            <Text style={styles.definitionText}>"{definition}"</Text>
            {definitionUz ? (
              <Text style={styles.definitionUzText}>({definitionUz})</Text>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.exampleText}>Example: {example}</Text>
            {exampleUz ? (
              <Text style={styles.exampleUzText}>Tarjima: {exampleUz}</Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>

      {/* 3 ta Oraliq Takrorlash (SRS) Tugmasi (TZ.txt 4.2) */}
      <View style={styles.srsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.srsButton, { backgroundColor: srsModes.hard.bg }]}
          onPress={() => onSelectSRS && onSelectSRS('hard')}
        >
          <Text style={[styles.srsButtonText, { color: srsModes.hard.color }]}>
            ● {srsModes.hard.labelUz}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.srsButton, { backgroundColor: srsModes.review.bg }]}
          onPress={() => onSelectSRS && onSelectSRS('review')}
        >
          <Text style={[styles.srsButtonText, { color: srsModes.review.color }]}>
            ● {srsModes.review.labelUz}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.srsButton, { backgroundColor: srsModes.mastered.bg }]}
          onPress={() => onSelectSRS && onSelectSRS('mastered')}
        >
          <Text style={[styles.srsButtonText, { color: srsModes.mastered.color }]}>
            ✓ {srsModes.mastered.labelUz}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: width - 40,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    alignSelf: 'center',
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: colors.primary.light,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.DEFAULT,
  },
  audioButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioIcon: {
    fontSize: 18,
  },
  wordImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 16,
  },
  wordBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  wordTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  phoneticText: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  flipArea: {
    minHeight: 110,
    justifyContent: 'center',
    marginBottom: 16,
  },
  tapToReveal: {
    backgroundColor: colors.background.DEFAULT,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderStyle: 'dashed',
  },
  tapText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  translationBox: {
    backgroundColor: colors.background.DEFAULT,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  uzbekText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.DEFAULT,
    textAlign: 'center',
    marginBottom: 6,
  },
  definitionText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text.primary,
    textAlign: 'center',
  },
  definitionUzText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.DEFAULT,
    marginVertical: 10,
  },
  exampleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  exampleUzText: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  srsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  srsButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  srsButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
