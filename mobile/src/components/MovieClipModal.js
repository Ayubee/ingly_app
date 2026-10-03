import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ImageBackground,
  Linking,
  Alert,
} from 'react-native';
import { colors } from '../theme.js';

const { width } = Dimensions.get('window');

// Mashhur filmlar uchun sifatli kino fonlari (poster/still)
const MOVIE_BACKDROPS = {
  'harry potter': 'https://images.unsplash.com/photo-1547756536-cde3673fa2e5?w=800&q=80',
  'friends': 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&q=80',
  'avengers: endgame': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&q=80',
  'the lord of the rings': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  'default': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80',
};

export default function MovieClipModal({
  visible = false,
  onClose,
  wordData,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSeconds, setPlaySeconds] = useState(0);

  useEffect(() => {
    let interval = null;
    if (visible && isPlaying) {
      interval = setInterval(() => {
        setPlaySeconds((prev) => {
          if (prev >= 4) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setPlaySeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible, isPlaying]);

  if (!wordData) return null;

  const rawWord = wordData.word || '';
  const cleanWord = rawWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const movieTitle = wordData.movieTitle || wordData.movie_title || wordData.movie || 'Kino Konteksti';
  const movieQuote = wordData.movieQuote || wordData.clip || wordData.example || `"${rawWord}" dialogda`;
  const movieClipUrl = wordData.movieClipUrl || wordData.video_clip_url || wordData.videoUrl;

  // Filmni aniqlab mos fon rasmini tanlash
  const lowerMovie = (movieTitle || '').toLowerCase();
  let backdropUrl = MOVIE_BACKDROPS.default;
  for (const [key, url] of Object.entries(MOVIE_BACKDROPS)) {
    if (lowerMovie.includes(key)) {
      backdropUrl = url;
      break;
    }
  }

  // 1. YouTube da aynan shu kino sahnasini qidirish havolasi
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${movieTitle} ${cleanWord} scene movie clip`
  )}`;

  // 2. YouGlish orqali kinolardan jonli subtitrli parcha havolasi
  const youglishUrl = `https://youglish.com/pronounce/${encodeURIComponent(cleanWord)}/english`;

  // Videoni ochish funksiyasi
  const handleOpenVideo = async (targetUrl) => {
    try {
      const urlToOpen = movieClipUrl || targetUrl;
      const supported = await Linking.canOpenURL(urlToOpen);
      if (supported) {
        await Linking.openURL(urlToOpen);
      } else {
        await Linking.openURL(targetUrl);
      }
    } catch (err) {
      console.warn('Video ochishda xatolik:', err);
      // Fallback: brauzerda ochish
      try {
        await Linking.openURL(targetUrl);
      } catch (e) {
        Alert.alert(
          'Video xabari',
          `"${movieTitle}" filmining "${cleanWord}" sahnasini ko'rish uchun internet brauzeringizdan foydalaning.`
        );
      }
    }
  };

  const handleTogglePlaySimulation = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      // Agar direct video bo'lsa yoki 1-bosishda jonli videoga o'tishni istasa
    } else {
      setIsPlaying(false);
    }
  };

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

          {/* Interactive Cinematic Video Player Frame */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleOpenVideo(youtubeUrl)}
            style={styles.playerContainer}
          >
            <ImageBackground
              source={{ uri: backdropUrl }}
              style={styles.videoPlayer}
              imageStyle={{ borderRadius: 18 }}
            >
              {/* Dark cinematic gradient overlay */}
              <View style={styles.videoOverlay}>
                <View style={styles.videoTopRow}>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>HD • 00:0{playSeconds} / 00:04</Text>
                  </View>
                  <View style={styles.movieTag}>
                    <Text style={styles.movieTagText} numberOfLines={1}>{movieTitle}</Text>
                  </View>
                </View>

                {/* Big Center Play / Video Button */}
                <View style={styles.centerPlayBox}>
                  <View style={[styles.playCircle, isPlaying && styles.playCircleActive]}>
                    <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
                  </View>
                  <Text style={styles.playPromptText}>
                    {isPlaying ? 'Ijro etilmoqda...' : 'Videoni ko\'rish uchun bosing'}
                  </Text>
                </View>

                {/* Subtitle preview bar on player */}
                <View style={styles.playerSubtitleBar}>
                  <Text style={styles.playerSubtitleText} numberOfLines={1}>
                    {movieQuote}
                  </Text>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>

          {/* Subtitles & Quote Box */}
          <View style={styles.quoteBox}>
            <View style={styles.quoteHeaderRow}>
              <Text style={styles.quoteLabel}>Kinodagi aniq lahza:</Text>
              <Text style={styles.wordPill}>{rawWord}</Text>
            </View>
            <Text style={styles.quoteText}>{movieQuote}</Text>
            {wordData.uzbek && (
              <Text style={styles.uzbekMeaningText}>
                O'zbekcha ma'nosi: <Text style={{ color: '#0284C7', fontWeight: '800' }}>{wordData.uzbek}</Text>
              </Text>
            )}
          </View>

          {/* Direct Video Action Buttons */}
          <View style={styles.videoActionsRow}>
            {/* 1. YouTube Video Scene Button */}
            <TouchableOpacity
              style={styles.youtubeActionBtn}
              activeOpacity={0.8}
              onPress={() => handleOpenVideo(youtubeUrl)}
            >
              <Text style={styles.actionBtnIcon}>▶️</Text>
              <View>
                <Text style={styles.youtubeActionTitle}>YouTube'da Sahna (HD)</Text>
                <Text style={styles.youtubeActionSub}>Kinodan olingan lavhani ko'rish</Text>
              </View>
            </TouchableOpacity>

            {/* 2. YouGlish Native Subtitle Clip Button */}
            <TouchableOpacity
              style={styles.youglishActionBtn}
              activeOpacity={0.8}
              onPress={() => handleOpenVideo(youglishUrl)}
            >
              <Text style={styles.actionBtnIcon}>🌐</Text>
              <View>
                <Text style={styles.youglishActionTitle}>YouGlish Video Klip</Text>
                <Text style={styles.youglishActionSub}>Jonli talaffuz va subtitrlar</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.tipText}>
            💡 Kinodan olingan bu hissiy video lavha so'zni miyangizda umrbod eslab qolishga yordam beradi.
          </Text>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeActionButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeActionText}>Tushunarli, darsga qaytish</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalBox: {
    width: width - 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  playerContainer: {
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 12,
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'space-between',
    padding: 12,
  },
  videoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  movieTag: {
    backgroundColor: 'rgba(91, 77, 255, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 150,
  },
  movieTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  centerPlayBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 6,
  },
  playCircleActive: {
    backgroundColor: '#38BDF8',
  },
  playIcon: {
    fontSize: 22,
    color: '#5B4DFF',
    marginLeft: 3,
  },
  playPromptText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  playerSubtitleBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  playerSubtitleText: {
    color: '#FEF08A',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  quoteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  quoteLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  wordPill: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5B4DFF',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quoteText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 4,
  },
  uzbekMeaningText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    marginTop: 2,
  },
  videoActionsRow: {
    gap: 8,
    marginBottom: 10,
  },
  youtubeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  youglishActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  actionBtnIcon: {
    fontSize: 20,
  },
  youtubeActionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  youtubeActionSub: {
    fontSize: 10,
    color: '#7F1D1D',
  },
  youglishActionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  youglishActionSub: {
    fontSize: 10,
    color: '#0369A1',
  },
  tipText: {
    fontSize: 10.5,
    color: '#64748B',
    lineHeight: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  closeActionButton: {
    backgroundColor: '#5B4DFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
