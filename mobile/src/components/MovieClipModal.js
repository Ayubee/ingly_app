import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { colors } from '../theme.js';

const { width } = Dimensions.get('window');

export default function MovieClipModal({
  visible = false,
  onClose,
  wordData,
}) {
  if (!wordData) return null;

  const movieClipUrl = wordData.movieClipUrl || wordData.video_clip_url || wordData.videoUrl;
  const movieTitle = wordData.movieTitle || wordData.movie_title || wordData.movie;
  const movieQuote = wordData.movieQuote || wordData.clip || wordData.example || (wordData.word ? `Context: "${wordData.word}" in conversation` : null);
  const movieYear = wordData.movieYear || (movieTitle ? 'Klassika' : null);

  const hasMovieContent = Boolean(movieClipUrl || movieTitle || movieQuote);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🎬 KINO KONTEKSTI (3-5s)</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Video Player Frame or Fallback */}
          {hasMovieContent ? (
            <View style={styles.videoPlayer}>
              <View style={styles.videoBadge}>
                <Text style={styles.videoBadgeText}>HD • 00:04</Text>
              </View>
              <Text style={styles.playIcon}>▶</Text>
              <Text style={styles.movieTitle}>
                {movieTitle || 'Mashhur Kino Sahna'} {movieYear ? `(${movieYear})` : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.fallbackContainer}>
              <Text style={styles.fallbackIcon}>🎬</Text>
              <Text style={styles.fallbackTitle}>Video lavha hozircha mavjud emas</Text>
              <Text style={styles.fallbackDesc}>
                "{wordData.word || 'Ushbu so\'z'}" uchun kino lavhasi tayyorlanmoqda. Tez orada ilovaning keyingi yangilanishida qo'shiladi!
              </Text>
            </View>
          )}

          {/* Subtitles & Quote */}
          {movieQuote ? (
            <View style={styles.quoteBox}>
              <Text style={styles.quoteLabel}>Kinodagi aniq lahza:</Text>
              <Text style={styles.quoteText}>{movieQuote}</Text>
            </View>
          ) : (
            <View style={styles.quoteBox}>
              <Text style={styles.quoteLabel}>So'z ma'nosi:</Text>
              <Text style={styles.quoteText}>{wordData.uzbek || wordData.definition || wordData.word}</Text>
            </View>
          )}

          <Text style={styles.tipText}>
            💡 Kinodan olingan bu hissiy lavha so'zni miyangizda umrbod eslab qolishga yordam beradi.
          </Text>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Tushunarli, darsga qaytish</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: width - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  videoPlayer: {
    height: 180,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 16,
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  playIcon: {
    fontSize: 40,
    color: '#38BDF8',
    marginBottom: 8,
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  quoteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quoteLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  quoteText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    fontStyle: 'italic',
  },
  tipText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 10,
    lineHeight: 16,
  },
  actionButton: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fallbackContainer: {
    height: 180,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  fallbackIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    textAlign: 'center',
  },
  fallbackDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
});
