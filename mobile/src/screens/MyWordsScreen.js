/**
 * INGLY MOBILE APPLICATION
 * MyWordsScreen.js - Foydalanuvchining Shaxsiy Lug'ati & Kartochkalar Bo'limi
 * 
 * Imkoniyatlari:
 * 1. Foydalanuvchi xohlagan so'z yoki iborani yozadi.
 * 2. Tizim uni ingliz tiliga (yoki o'zbekchaga) bir zumda avtomatik tarjima qiladi va yangi kartochka yaratadi.
 * 3. Kartochka bosilganda: so'z ko'rinadi, lekin tarjimasi YASHIRINGAN bo'ladi.
 * 4. "👁️ Tarjimani ko'rish" bosilganda: tarjima ochiladi va tagida "✅ Yodladim" hamda "❌ Yodlamadim" tugmalari chiqadi.
 * 5. "✅ Yodladim" bosilsa: kartochka yopilib, "Yodlanganlar" bo'limiga o'tadi.
 * 6. "❌ Yodlamadim" bosilsa: kartochka yopilib, "Yodlanmaganlar" bo'limida qoladi.
 * 7. Bo'limlar: "⏳ Yodlanmaganlar", "✅ Yodlanganlar", "📑 Barchasi".
 * 8. Audio talaffuz (TTS) eshitish imkoniyati.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Keyboard,
  Animated,
} from 'react-native';
import { colors } from '../theme.js';
import {
  getCustomWords,
  addCustomWord,
  setCustomWordLearnedStatus,
  deleteCustomWord,
} from '../services/storage.js';
import { translateText } from '../services/translatorService.js';
import { speak } from '../services/ttsService.js';
import { useUser } from '../context/UserContext.js';

export default function MyWordsScreen({ onNavigate }) {
  const { recordWordLearned } = useUser();

  // Holatlar (State)
  const [wordsList, setWordsList] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeTab, setActiveTab] = useState('unlearned'); // 'unlearned' | 'learned' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Kartochka o'rganish modali holati
  const [activeCard, setActiveCard] = useState(null);
  const [isRevealed, setIsRevealed] = useState(false);

  // Ketma-ket takrorlash (Study Session) holati
  const [studyQueue, setStudyQueue] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);

  // Animatsiyalar
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Dastlabki yuklash
  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    let list = await getCustomWords();
    if (!list || list.length === 0) {
      const initialSamples = [
        {
          id: 'custom_sample_1',
          original: 'Kitob',
          translated: 'Book',
          phonetic: '/bʊk/',
          example: 'I am reading an interesting book.',
          learned: false,
          created_at: new Date().toISOString(),
          review_count: 0,
        },
        {
          id: 'custom_sample_2',
          original: 'Maktab',
          translated: 'School',
          phonetic: '/skuːl/',
          example: 'Children go to school every morning.',
          learned: false,
          created_at: new Date().toISOString(),
          review_count: 0,
        },
        {
          id: 'custom_sample_3',
          original: 'Muvaffaqiyat',
          translated: 'Success',
          phonetic: '/səkˈses/',
          example: 'Hard work brings great success.',
          learned: true,
          learned_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          review_count: 1,
        },
      ];
      for (const s of initialSamples) {
        await addCustomWord(s);
      }
      list = initialSamples;
    }
    setWordsList(list);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Yangi so'z yozilganda tarjima qilish va kartochka yaratish
  const handleAddWord = async () => {
    const clean = inputText.trim();
    if (!clean) {
      showToast('⚠️ Iltimos, biror so\'z yoki ibora yozing!');
      return;
    }

    Keyboard.dismiss();
    setIsTranslating(true);

    try {
      const res = await translateText(clean);
      if (!res.success) {
        showToast('⚠️ ' + (res.error || 'Tarjima qilishda xatolik yuz berdi.'));
        setIsTranslating(false);
        return;
      }

      // Agar o'zbekcha yozilgan bo'lsa -> original: o'zbekcha, translated: inglizcha
      // Agar inglizcha yozilgan bo'lsa -> original: o'zbekcha, translated: inglizcha
      let wordEn = res.translated;
      let wordUz = res.original;

      if (res.langFrom === 'en') {
        wordEn = res.original;
        wordUz = res.translated;
      }

      const newCard = await addCustomWord({
        original: wordUz,
        translated: wordEn,
        phonetic: res.phonetic || '',
        pos: res.pos || '',
        definition: res.definition || '',
        example: res.example || '',
        learned: false,
      });

      setWordsList(prev => [newCard, ...prev]);
      setInputText('');
      showToast(`🎉 "${wordUz}" ➔ "${wordEn}" kartochkasi yaratildi!`);
      setActiveTab('unlearned');
    } catch (e) {
      console.warn('handleAddWord xatosi:', e);
      showToast('Xatolik yuz berdi, qaytadan urinib ko\'ring');
    } finally {
      setIsTranslating(false);
    }
  };

  // Kartochkani bosganda ochish (Tarjimasi yashiringan holda)
  const openCardForStudy = (card) => {
    setActiveCard(card);
    setIsRevealed(false);
    fadeAnim.setValue(0);
  };

  // "Tarjimani ko'rish" bosilganda
  const handleRevealTranslation = () => {
    setIsRevealed(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    // Inglizcha so'z talaffuzini eshittirish
    if (activeCard && activeCard.translated) {
      speak(activeCard.translated);
    }
  };

  // "✅ YODLADIM" bosilganda: kartochka yopilib, "Yodlanganlar"ga o'tadi
  const handleMarkLearned = async () => {
    if (!activeCard) return;
    const cardId = activeCard.id;
    const cardName = activeCard.original || activeCard.translated;

    // Holatni yangilash
    const updated = await setCustomWordLearnedStatus(cardId, true);
    setWordsList(updated);

    // Kundalik progress va streak hisobiga qo'shish
    if (recordWordLearned) {
      recordWordLearned();
    }

    // Modalni yopish
    setActiveCard(null);
    setIsRevealed(false);
    showToast(`🎉 Barakalla! "${cardName}" so'zi "Yodlanganlar" bo'limiga o'tkazildi!`);

    // Agar ketma-ket takrorlash rejimida bo'lsa, keyingi so'zga o'tish
    if (studyQueue.length > 0 && studyIndex + 1 < studyQueue.length) {
      const nextIdx = studyIndex + 1;
      setStudyIndex(nextIdx);
      setTimeout(() => {
        openCardForStudy(studyQueue[nextIdx]);
      }, 350);
    } else if (studyQueue.length > 0) {
      setStudyQueue([]);
      showToast('🏆 Barcha tanlangan kartochkalar muvaffaqiyatli takrorlandi!');
    }
  };

  // "❌ YODLAMADIM" bosilganda: kartochka yopilib, "Yodlanmaganlar"da qoladi
  const handleMarkUnlearned = async () => {
    if (!activeCard) return;
    const cardId = activeCard.id;
    const cardName = activeCard.original || activeCard.translated;

    // Holatni yodlanmagan deb belgilash
    const updated = await setCustomWordLearnedStatus(cardId, false);
    setWordsList(updated);

    // Modalni yopish
    setActiveCard(null);
    setIsRevealed(false);
    showToast(`🔄 "${cardName}" so'zi "Yodlanmaganlar" bo'limida qoldi. Takrorlashda davom eting!`);

    // Agar ketma-ket takrorlash rejimida bo'lsa, keyingi so'zga o'tish
    if (studyQueue.length > 0 && studyIndex + 1 < studyQueue.length) {
      const nextIdx = studyIndex + 1;
      setStudyIndex(nextIdx);
      setTimeout(() => {
        openCardForStudy(studyQueue[nextIdx]);
      }, 350);
    } else if (studyQueue.length > 0) {
      setStudyQueue([]);
    }
  };

  // Kartochkani o'chirish
  const handleDeleteCard = (card) => {
    Alert.alert(
      'Kartochkani o\'chirish',
      `"${card.original}" (${card.translated}) kartochkasini o'chirmoqchimisiz?`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'O\'chirish',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteCustomWord(card.id);
            setWordsList(updated);
            if (activeCard && activeCard.id === card.id) {
              setActiveCard(null);
            }
            showToast('🗑️ Kartochka o\'chirildi');
          },
        },
      ]
    );
  };

  // Barcha yodlanmaganlarni ketma-ket takrorlash rejimini boshlash
  const startFullStudySession = () => {
    const unlearned = wordsList.filter(w => !w.learned);
    if (unlearned.length === 0) {
      showToast('Sizda hali yodlanmagan kartochkalar yo\'q!');
      return;
    }
    setStudyQueue(unlearned);
    setStudyIndex(0);
    openCardForStudy(unlearned[0]);
  };

  // Filtrlash va qidiruv
  const filteredWords = useMemo(() => {
    return wordsList.filter((item) => {
      // Tab filtri
      if (activeTab === 'unlearned' && item.learned) return false;
      if (activeTab === 'learned' && !item.learned) return false;

      // Qidiruv filtri
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const o = (item.original || '').toLowerCase();
        const t = (item.translated || '').toLowerCase();
        return o.includes(q) || t.includes(q);
      }

      return true;
    });
  }, [wordsList, activeTab, searchQuery]);

  // Statistik hisoblar
  const counts = useMemo(() => {
    const total = wordsList.length;
    const learned = wordsList.filter(w => w.learned).length;
    const unlearned = total - learned;
    return { total, learned, unlearned };
  }, [wordsList]);

  return (
    <View style={styles.container}>
      {/* Toast Bildirishnoma */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Asosiy Sarlavha & Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <View style={styles.badgeRow}>
              <Text style={styles.headerBadge}>SHAXSIY LUG'AT</Text>
              <Text style={styles.headerDot}>•</Text>
              <Text style={styles.headerSubBadge}>Tarjima & Kartochka</Text>
            </View>
            <View style={{ marginTop: 2 }}>
              <Text style={styles.headerTitle}>Mening Lug'atim</Text>
            </View>
          </View>
          {counts.unlearned > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={startFullStudySession}
              style={styles.studyNowButton}
            >
              <Text style={styles.studyNowIcon}>🎴</Text>
              <Text style={styles.studyNowText}>Takrorlash</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerSubtitle}>
          Xohlagan so'zingizni yozing, tarjima qiling va kartochkalarda yodlang!
        </Text>

        {/* Statistik Pilllar */}
        <View style={styles.statsRow}>
          <View style={[styles.statPill, activeTab === 'unlearned' && styles.statPillActive]}>
            <Text style={styles.statPillNum}>{counts.unlearned}</Text>
            <Text style={styles.statPillLbl}>⏳ Yodlanmagan</Text>
          </View>
          <View style={[styles.statPill, activeTab === 'learned' && styles.statPillActive]}>
            <Text style={[styles.statPillNum, { color: colors.status.mastered }]}>{counts.learned}</Text>
            <Text style={styles.statPillLbl}>✅ Yodlangan</Text>
          </View>
          <View style={[styles.statPill, activeTab === 'all' && styles.statPillActive]}>
            <Text style={[styles.statPillNum, { color: colors.primary.DEFAULT }]}>{counts.total}</Text>
            <Text style={styles.statPillLbl}>📑 Jami so'z</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* So'z kiritish & Tarjima qilish Bloki */}
        <View style={styles.inputCard}>
          <View style={styles.inputCardHeader}>
            <Text style={styles.inputCardIcon}>✍️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputCardTitle}>Yangi So'z Qo'shish & Tarjima Qilish</Text>
              <Text style={styles.inputCardDesc}>
                O'zbekcha yoki inglizcha so'z yozing (masalan: kitob, olma, run, think)
              </Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="So'z yoki ibora yozing..."
              placeholderTextColor="#94A3B8"
              returnKeyType="done"
              onSubmitEditing={handleAddWord}
              editable={!isTranslating}
            />
            {inputText.length > 0 && (
              <TouchableOpacity
                onPress={() => setInputText('')}
                style={styles.clearInputBtn}
              >
                <Text style={styles.clearInputText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddWord}
            disabled={isTranslating || !inputText.trim()}
            style={[
              styles.translateBtn,
              (!inputText.trim() || isTranslating) && styles.translateBtnDisabled,
            ]}
          >
            {isTranslating ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.translateBtnText}>Tarjima qilinmoqda...</Text>
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <Text style={{ fontSize: 16 }}>✨</Text>
                <Text style={styles.translateBtnText}>Tarjima Qilish & Kartochka Yaratish</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Selector & Qidiruv */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveTab('unlearned')}
              style={[styles.tabBtn, activeTab === 'unlearned' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === 'unlearned' && styles.tabBtnTextActive]}>
                ⏳ Yodlanmaganlar ({counts.unlearned})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveTab('learned')}
              style={[styles.tabBtn, activeTab === 'learned' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === 'learned' && styles.tabBtnTextActive]}>
                ✅ Yodlanganlar ({counts.learned})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveTab('all')}
              style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>
                📑 Barchasi ({counts.total})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Qidiruv Paneli */}
          {wordsList.length > 3 && (
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Kartochkalar orasidan qidirish..."
                placeholderTextColor="#94A3B8"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Kartochkalar Ro'yxati */}
        {filteredWords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>
              {activeTab === 'learned' ? '🎓' : activeTab === 'unlearned' ? '✨' : '🗂️'}
            </Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'learned'
                ? 'Hozircha yodlangan kartochkalar yo\'q'
                : activeTab === 'unlearned'
                ? 'Barcha so\'zlar yodlab bo\'lindi yoki yangi so\'z qo\'shilmagan'
                : 'Kartochkalar topilmadi'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'unlearned'
                ? 'Yuqoridagi maydonga yangi so\'z yozib "Tarjima Qilish" tugmasini bosing!'
                : 'Kartochkaga bosib, tarjimani ko\'ring va "Yodladim" tugmasini bosing.'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filteredWords.map((card) => {
              const isLearned = !!card.learned;
              return (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={0.85}
                  onPress={() => openCardForStudy(card)}
                  style={[
                    styles.cardItem,
                    isLearned ? styles.cardItemLearned : styles.cardItemUnlearned,
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardWordRow}>
                      <Text style={styles.cardWordTitle}>{card.original}</Text>
                      {card.translated && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => speak(card.translated)}
                          style={styles.audioMiniBtn}
                        >
                          <Text style={styles.audioMiniIcon}>🔊</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.cardActionRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          isLearned ? styles.statusBadgeLearned : styles.statusBadgeUnlearned,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isLearned
                              ? styles.statusBadgeTextLearned
                              : styles.statusBadgeTextUnlearned,
                          ]}
                        >
                          {isLearned ? '✓ Yodlangan' : '⏳ Yodlanmagan'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => handleDeleteCard(card)}
                        style={styles.deleteMiniBtn}
                      >
                        <Text style={styles.deleteMiniIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <View style={styles.cardHintBadge}>
                      <Text style={styles.cardHintIcon}>🔒</Text>
                      <Text style={styles.cardHintText}>
                        Tarjimasi yashiringan (Bosing ➔)
                      </Text>
                    </View>
                    <Text style={styles.cardOpenArrow}>👁️ Ochish</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ===================================================================
          KARTOCHKA O'RGANISH VA YODLASH MODALI (CORE REQUIREMENT)
          =================================================================== */}
      <Modal
        visible={Boolean(activeCard)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setActiveCard(null);
          setIsRevealed(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.studyCardContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.modalTag}>KARTOCHKA BILAN O'RGANISH</Text>
                {studyQueue.length > 0 && (
                  <Text style={styles.studyQueueIndex}>
                    {studyIndex + 1} / {studyQueue.length}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setActiveCard(null);
                  setIsRevealed(false);
                }}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Asosiy Kartochka Korpus */}
            {activeCard && (
              <View style={styles.studyCardBody}>
                {/* 1. Foydalanuvchi yozgan so'z (DOIM KO'RINADI) */}
                <View style={styles.mainWordSection}>
                  <Text style={styles.mainWordLabel}>So'z / Ibora:</Text>
                  <Text style={styles.mainWordText}>{activeCard.original}</Text>
                  {activeCard.translated && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => speak(activeCard.translated)}
                      style={styles.soundButton}
                    >
                      <Text style={styles.soundIcon}>🔊</Text>
                      <Text style={styles.soundText}>Talaffuzni tinglash</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 2. Tarjima qismi: Boshida YASHIRINGAN bo'ladi */}
                {!isRevealed ? (
                  <View style={styles.hiddenTranslationBox}>
                    <Text style={styles.hiddenLockIcon}>🙈</Text>
                    <Text style={styles.hiddenTitle}>Tarjima Yashiringan</Text>
                    <Text style={styles.hiddenSub}>
                      Xotirangizda tarjimani eslashga harakat qiling!
                    </Text>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleRevealTranslation}
                      style={styles.revealButton}
                    >
                      <Text style={styles.revealBtnIcon}>👁️</Text>
                      <Text style={styles.revealBtnText}>Tarjimani Ko'rish</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* 3. Tarjima ochilgandan keyin ko'rinadigan qism */
                  <Animated.View style={[styles.revealedTranslationBox, { opacity: fadeAnim }]}>
                    <View style={styles.revealedHeaderRow}>
                      <Text style={styles.revealedLabel}>Inglizcha Tarjimasi:</Text>
                      <Text style={styles.revealedBadge}>Ochildi ✓</Text>
                    </View>

                    <Text style={styles.revealedWordText}>{activeCard.translated}</Text>

                    {activeCard.phonetic ? (
                      <Text style={styles.phoneticText}>{activeCard.phonetic}</Text>
                    ) : null}

                    {activeCard.example ? (
                      <View style={styles.exampleBox}>
                        <Text style={styles.exampleLabel}>Misol gap:</Text>
                        <Text style={styles.exampleText}>"{activeCard.example}"</Text>
                      </View>
                    ) : null}

                    {/* 4. Tagida YODLADIM va YODLAMADIM tugmalari (Core Requirement) */}
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleMarkUnlearned}
                        style={styles.btnNotLearned}
                      >
                        <Text style={styles.btnNotLearnedIcon}>❌</Text>
                        <View>
                          <Text style={styles.btnNotLearnedTitle}>YODLAMADIM</Text>
                          <Text style={styles.btnNotLearnedSub}>Yodlanmaganlarda qolsin</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleMarkLearned}
                        style={styles.btnLearned}
                      >
                        <Text style={styles.btnLearnedIcon}>✅</Text>
                        <View>
                          <Text style={styles.btnLearnedTitle}>YODLADIM</Text>
                          <Text style={styles.btnLearnedSub}>Yodlanganlarga o'tsin</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 999,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    alignItems: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary.DEFAULT,
    letterSpacing: 0.8,
  },
  headerDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  headerSubBadge: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  headerTitleH1: {
    margin: 0,
    padding: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 2,
  },
  studyNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary.light,
    borderColor: colors.primary.DEFAULT,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  studyNowIcon: {
    fontSize: 14,
  },
  studyNowText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  statPillActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: colors.primary.light,
  },
  statPillNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  statPillLbl: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 18,
  },
  inputCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  inputCardIcon: {
    fontSize: 22,
    backgroundColor: colors.primary.light,
    padding: 8,
    borderRadius: 12,
  },
  inputCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputCardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    height: 46,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  clearInputBtn: {
    padding: 6,
  },
  clearInputText: {
    color: '#94A3B8',
    fontWeight: '800',
    fontSize: 12,
  },
  translateBtn: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  translateBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  translateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tabsContainer: {
    marginBottom: 14,
  },
  tabButtonsRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: colors.primary.DEFAULT,
    fontWeight: '800',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    height: 38,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
  cardsGrid: {
    gap: 10,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardItemUnlearned: {
    borderColor: '#E2E8F0',
    borderLeftWidth: 4.5,
    borderLeftColor: '#F59E0B',
  },
  cardItemLearned: {
    borderColor: '#E2E8F0',
    borderLeftWidth: 4.5,
    borderLeftColor: colors.status.mastered,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardWordTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  audioMiniBtn: {
    backgroundColor: '#F1F5F9',
    padding: 5,
    borderRadius: 8,
  },
  audioMiniIcon: {
    fontSize: 12,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  statusBadgeUnlearned: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeLearned: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextUnlearned: {
    color: '#B45309',
  },
  statusBadgeTextLearned: {
    color: '#15803D',
  },
  deleteMiniBtn: {
    padding: 5,
  },
  deleteMiniIcon: {
    fontSize: 13,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardHintIcon: {
    fontSize: 11,
  },
  cardHintText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  cardOpenArrow: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },

  /* ===================================================================
     MODAL STYLES (Interactive study card)
     =================================================================== */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  studyCardContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTag: {
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.primary.DEFAULT,
    letterSpacing: 0.8,
  },
  studyQueueIndex: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  studyCardBody: {
    gap: 16,
  },
  mainWordSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mainWordLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mainWordText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  soundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary.light,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  soundIcon: {
    fontSize: 14,
  },
  soundText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary.DEFAULT,
  },
  hiddenTranslationBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderStyle: 'dashed',
  },
  hiddenLockIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  hiddenTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
  },
  hiddenSub: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  revealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  revealBtnIcon: {
    fontSize: 15,
  },
  revealBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  revealedTranslationBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    gap: 12,
  },
  revealedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revealedLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    textTransform: 'uppercase',
  },
  revealedBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  revealedWordText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#064E3B',
    textAlign: 'center',
  },
  phoneticText: {
    fontSize: 13,
    color: '#047857',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
  exampleBox: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  exampleLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  exampleText: {
    fontSize: 11.5,
    color: '#1E293B',
    fontStyle: 'italic',
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btnNotLearned: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  btnNotLearnedIcon: {
    fontSize: 18,
  },
  btnNotLearnedTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#BE123C',
  },
  btnNotLearnedSub: {
    fontSize: 9.5,
    color: '#E11D48',
    fontWeight: '600',
    marginTop: 1,
  },
  btnLearned: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnLearnedIcon: {
    fontSize: 18,
  },
  btnLearnedTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  btnLearnedSub: {
    fontSize: 9.5,
    color: '#D1FAE5',
    fontWeight: '600',
    marginTop: 1,
  },
});
