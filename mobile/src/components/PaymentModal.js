/**
 * INGLY MOBILE - PAYMENT MODAL (CLICK, PAYME, BANK KARTA)
 * 
 * VIP oylik obunasi yoki pullik kitoblarni sotib olish uchun universal to'lov modali:
 * 1. Click (Click Up / Click Web)
 * 2. Payme (Payme checkout)
 * 3. To'g'ridan-to'g'ri bank kartasi (Uzcard, Humo, Visa, Mastercard)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { colors } from '../theme.js';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storage.js';
import { getAppSettings } from '../services/appSettingsService.js';

export default function PaymentModal({
  visible,
  onClose,
  itemType = 'vip', // 'vip' | 'book'
  itemTitle = 'Ingly VIP Oylik Obuna',
  price = 29000,
  originalPrice = null,
  bookId = null,
  onSuccess,
  userPhone = '',
}) {
  const [selectedMethod, setSelectedMethod] = useState('card'); // 'card' | 'click' | 'payme'
  const [phoneInput, setPhoneInput] = useState(userPhone || '+998 ');
  
  // Card Inputs
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  // Saved Cards State
  const [savedCards, setSavedCards] = useState([]);
  const [saveCard, setSaveCard] = useState(true);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState(null);
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsProcessing(false);
      setIsSuccess(false);
      loadSavedCards();
      if (userPhone && (!phoneInput || phoneInput === '+998 ')) {
        setPhoneInput(userPhone);
      }
    }
  }, [visible, userPhone]);

  const loadSavedCards = async () => {
    try {
      const list = await getStorageItem(STORAGE_KEYS.SAVED_CARDS, []);
      if (Array.isArray(list) && list.length > 0) {
        setSavedCards(list);
      } else {
        setSavedCards([]);
      }
    } catch (e) {
      console.warn('Failed to load saved cards:', e);
    }
  };

  const handleSelectSavedCard = (sc) => {
    setSelectedSavedCardId(sc.id);
    setCardNumber(sc.cardNumber || '');
    setCardExpiry(sc.cardExpiry || '');
    setCardHolder(sc.cardHolder || '');
  };

  const handleAddNewCard = () => {
    setSelectedSavedCardId(null);
    setCardNumber('');
    setCardExpiry('');
    setCardHolder('');
  };

  const handleDeleteSavedCard = (cardId) => {
    Alert.alert(
      "Kartani o'chirish",
      "Ushbu saqlangan kartani ro'yxatdan o'chirmoqchimisiz?",
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: async () => {
            const updated = savedCards.filter((c) => c.id !== cardId);
            setSavedCards(updated);
            await setStorageItem(STORAGE_KEYS.SAVED_CARDS, updated);
            if (selectedSavedCardId === cardId) {
              handleAddNewCard();
            }
          },
        },
      ]
    );
  };

  // Karta turini aniqlash (Uzcard: 8600, Humo: 9860, Visa: 4, Mastercard: 5)
  const getCardType = (digits) => {
    const raw = String(digits || '').replace(/\D/g, '');
    if (raw.startsWith('8600')) return { name: 'UZCARD', color: '#1E40AF', bg: '#EFF6FF' };
    if (raw.startsWith('9860')) return { name: 'HUMO', color: '#D97706', bg: '#FEF3C7' };
    if (raw.startsWith('4')) return { name: 'VISA', color: '#15803D', bg: '#F0FDF4' };
    if (raw.startsWith('5')) return { name: 'MASTERCARD', color: '#B91C1C', bg: '#FEF2F2' };
    return { name: 'BANK KARTA', color: '#475569', bg: '#F1F5F9' };
  };

  // Karta raqamini formatlash: 8600 0000 0000 0000
  const handleCardNumberChange = (text) => {
    if (selectedSavedCardId) {
      setSelectedSavedCardId(null);
    }
    const raw = text.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    setCardNumber(parts.join(' '));
  };

  // Amal qilish muddatini formatlash: MM/YY
  const handleExpiryChange = (text) => {
    const raw = text.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2, 4)}`);
    } else {
      setCardExpiry(raw);
    }
  };

  // To'lovni amalga oshirish
  const handlePay = async () => {
    // 1. Validatsiya
    if (selectedMethod === 'card') {
      const rawCard = cardNumber.replace(/\D/g, '');
      if (rawCard.length < 16) {
        Alert.alert('Xatolik', 'Iltimos, 16 xonali to\'liq karta raqamini kiriting!');
        return;
      }
      const rawExp = cardExpiry.replace(/\D/g, '');
      if (rawExp.length < 4) {
        Alert.alert('Xatolik', 'Iltimos, kartaning amal qilish muddatini (MM/YY) to\'g\'ri kiriting!');
        return;
      }

      // Agar "Kartani saqlab qo'yish" tanlangan bo'lsa
      if (saveCard) {
        try {
          const meta = getCardType(cardNumber);
          const masked = `${rawCard.slice(0, 4)} •••• •••• ${rawCard.slice(-4)}`;
          const existingIdx = savedCards.findIndex((c) => c.rawNumber === rawCard);
          let updatedList = [...savedCards];
          if (existingIdx >= 0) {
            updatedList[existingIdx] = {
              ...updatedList[existingIdx],
              cardNumber,
              cardExpiry,
              cardHolder: cardHolder || 'INGLY FOYDALANUVCHISI',
              type: meta.name,
              color: meta.color,
              bg: meta.bg,
              maskedNumber: masked,
            };
          } else {
            const newCardObj = {
              id: 'card_' + Date.now(),
              rawNumber: rawCard,
              cardNumber,
              cardExpiry,
              cardHolder: cardHolder || 'INGLY FOYDALANUVCHISI',
              type: meta.name,
              color: meta.color,
              bg: meta.bg,
              maskedNumber: masked,
              savedAt: new Date().toISOString(),
            };
            updatedList = [newCardObj, ...updatedList];
          }
          setSavedCards(updatedList);
          await setStorageItem(STORAGE_KEYS.SAVED_CARDS, updatedList);
        } catch (saveErr) {
          console.warn('Kartani saqlashda xatolik:', saveErr);
        }
      }
    } else {
      const cleanPhone = phoneInput.replace(/\D/g, '');
      if (cleanPhone.length < 9) {
        Alert.alert('Xatolik', 'Iltimos, to\'g\'ri telefon raqam kiriting!');
        return;
      }
    }

    setIsProcessing(true);

    // To'lov shlyuzi bilan integratsiya (simulyatsiya va tasdiqlash)
    setTimeout(async () => {
      setIsProcessing(false);
      setIsSuccess(true);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess({
            itemType,
            itemTitle,
            price: effectivePrice,
            originalPrice: effectiveOriginalPrice,
            bookId,
            method: selectedMethod,
            timestamp: new Date().toISOString(),
          });
        }
      }, 1000);
    }, 1500);
  };

  const appSettings = getAppSettings();
  const effectiveOriginalPrice = originalPrice !== null && originalPrice !== undefined
    ? Number(originalPrice)
    : (itemType === 'vip'
        ? Number(appSettings?.premium_monthly_original_price || 59000)
        : Number(appSettings?.single_book_original_price || 35000));

  const effectivePrice = Number(price || (itemType === 'vip' ? (appSettings?.premium_monthly_price || 29000) : (appSettings?.single_book_price || 19000)));
  const hasDiscount = effectiveOriginalPrice > effectivePrice;
  const discountPercent = hasDiscount
    ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
    : 0;
  const savings = hasDiscount ? effectiveOriginalPrice - effectivePrice : 0;

  const cardMeta = getCardType(cardNumber);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerSubtitle}>
                {itemType === 'vip' ? '👑 Ingly VIP Obuna' : '📚 Kitob Xaridi'}
              </Text>
              <Text style={styles.headerTitle} numberOfLines={1}>{itemTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Price Tag with Discount */}
          <View style={styles.priceContainer}>
            <View>
              <Text style={styles.priceLabel}>To'lov summasi:</Text>
              {hasDiscount && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Text style={styles.originalPriceText}>
                    {effectiveOriginalPrice.toLocaleString('uz-UZ')} so'm
                  </Text>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>-{discountPercent}% AKSIYA</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.priceBadge}>
                <Text style={styles.priceValue}>
                  {effectivePrice.toLocaleString('uz-UZ')} so'm
                </Text>
                {itemType === 'vip' && <Text style={styles.pricePeriod}>/ oy</Text>}
              </View>
              {hasDiscount && (
                <Text style={styles.savingsText}>
                  Tejamkorlik: {savings.toLocaleString('uz-UZ')} so'm 🔥
                </Text>
              )}
            </View>
          </View>

          {isSuccess ? (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>🎉</Text>
              <Text style={styles.successTitle}>To'lov Muvaffaqiyatli!</Text>
              <Text style={styles.successDesc}>
                {itemType === 'vip'
                  ? 'VIP imtiyozlari 1 oyga faollashtirildi. Barcha kitoblar va kinolar siz uchun ochiq!'
                  : `${itemTitle} muvaffaqiyatli xarid qilindi va hisobingizga biriktirildi.`}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBody}>
              {/* Payment Method Selector */}
              <Text style={styles.methodLabel}>To'lov usulini tanlang:</Text>
              <View style={styles.methodTabsRow}>
                {/* Bank Karta */}
                <TouchableOpacity
                  style={[
                    styles.methodTab,
                    selectedMethod === 'card' && styles.methodTabActiveCard,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedMethod('card')}
                >
                  <Text style={styles.methodTabEmoji}>💳</Text>
                  <Text
                    style={[
                      styles.methodTabText,
                      selectedMethod === 'card' && styles.methodTabTextActive,
                    ]}
                  >
                    Bank Karta
                  </Text>
                </TouchableOpacity>

                {/* Click */}
                <TouchableOpacity
                  style={[
                    styles.methodTab,
                    selectedMethod === 'click' && styles.methodTabActiveClick,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedMethod('click')}
                >
                  <View style={styles.clickBadgeMini}>
                    <Text style={styles.clickTextMini}>🔵 Click</Text>
                  </View>
                </TouchableOpacity>

                {/* Payme */}
                <TouchableOpacity
                  style={[
                    styles.methodTab,
                    selectedMethod === 'payme' && styles.methodTabActivePayme,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedMethod('payme')}
                >
                  <View style={styles.paymeBadgeMini}>
                    <Text style={styles.paymeTextMini}>🟢 Payme</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* METHOD 1: BANK KARTA */}
              {selectedMethod === 'card' && (
                <View style={styles.tabContent}>
                  {/* Saved Cards Selector (if available) */}
                  {savedCards.length > 0 && (
                    <View style={styles.savedCardsWrapper}>
                      <View style={styles.savedCardsHeaderRow}>
                        <Text style={styles.savedCardsTitle}>💳 Saqlangan kartalar:</Text>
                        <TouchableOpacity
                          onPress={handleAddNewCard}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.newCardTextBtn}>
                            {selectedSavedCardId ? '+ Yangi karta' : 'Tozalash'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.savedCardsScrollList}
                      >
                        {savedCards.map((sc) => {
                          const isSelected = selectedSavedCardId === sc.id;
                          return (
                            <TouchableOpacity
                              key={sc.id}
                              style={[
                                styles.savedCardChip,
                                isSelected && styles.savedCardChipActive,
                              ]}
                              onPress={() => handleSelectSavedCard(sc)}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.savedCardTypePill, { backgroundColor: sc.bg || '#EFF6FF' }]}>
                                <Text style={[styles.savedCardTypeText, { color: sc.color || '#1E40AF' }]}>
                                  {sc.type || 'KARTA'}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.savedCardMaskedNumber,
                                  isSelected && styles.savedCardMaskedNumberActive,
                                ]}
                              >
                                {sc.maskedNumber || sc.cardNumber}
                              </Text>
                              <TouchableOpacity
                                onPress={() => handleDeleteSavedCard(sc.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.deleteCardBtn}
                              >
                                <Text style={styles.deleteCardBtnText}>✕</Text>
                              </TouchableOpacity>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Virtual Card Preview */}
                  <View style={styles.virtualCard}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardChip}>
                        <View style={styles.chipInner} />
                      </View>
                      <View style={[styles.cardTypeBadge, { backgroundColor: cardMeta.bg }]}>
                        <Text style={[styles.cardTypeBadgeText, { color: cardMeta.color }]}>
                          {cardMeta.name}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.virtualCardNumber}>
                      {cardNumber || '8600 •••• •••• ••••'}
                    </Text>

                    <View style={styles.cardFooterRow}>
                      <View>
                        <Text style={styles.cardHolderLabel}>KARTA EGASI</Text>
                        <Text style={styles.cardHolderValue}>
                          {cardHolder || 'INGLY FOYDALANUVCHISI'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.cardHolderLabel}>MUDDATI</Text>
                        <Text style={styles.cardHolderValue}>
                          {cardExpiry || 'MM/YY'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Inputs */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Karta raqami (Uzcard / Humo / Visa)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="8600 0000 0000 0000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={cardNumber}
                      onChangeText={handleCardNumberChange}
                      maxLength={19}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                      <Text style={styles.inputLabel}>Amal qilish muddati</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="MM/YY"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={cardExpiry}
                        onChangeText={handleExpiryChange}
                        maxLength={5}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1.5 }]}>
                      <Text style={styles.inputLabel}>Ism va Familiya</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Karta egasi"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="characters"
                        value={cardHolder}
                        onChangeText={setCardHolder}
                      />
                    </View>
                  </View>

                  {/* Save Card Toggle Button */}
                  <TouchableOpacity
                    style={styles.saveCardToggleRow}
                    onPress={() => setSaveCard(!saveCard)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkboxBox, saveCard && styles.checkboxBoxActive]}>
                      {saveCard && <Text style={styles.checkboxCheckmark}>✓</Text>}
                    </View>
                    <View style={styles.saveCardTexts}>
                      <Text style={styles.saveCardTitle}>
                        Kartani saqlab qo'yish 🔒
                      </Text>
                      <Text style={styles.saveCardSubtitle}>
                        Keyingi to'lovlarda kartani qayta kiritmasdan 1 bosishda to'lash
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <Text style={styles.securityNote}>
                    🔒 Barcha karta to'lovlari shifrlangan va xavfsiz himoyalangan.
                  </Text>
                </View>
              )}

              {/* METHOD 2: CLICK */}
              {selectedMethod === 'click' && (
                <View style={styles.tabContent}>
                  <View style={styles.methodInfoCard}>
                    <View style={styles.clickLogoBox}>
                      <Text style={styles.clickBigText}>CLICK UP</Text>
                    </View>
                    <Text style={styles.methodInfoTitle}>Click orqali tezkor to'lov</Text>
                    <Text style={styles.methodInfoDesc}>
                      Click tizimida ro'yxatdan o'tgan telefon raqamingizni kiriting.
                      Ilovangizga to'lov hisobi yuboriladi yoki hisobdan yechiladi.
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Click telefon raqamingiz:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="+998 90 123 45 67"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={phoneInput}
                      onChangeText={setPhoneInput}
                    />
                  </View>
                </View>
              )}

              {/* METHOD 3: PAYME */}
              {selectedMethod === 'payme' && (
                <View style={styles.tabContent}>
                  <View style={styles.methodInfoCard}>
                    <View style={styles.paymeLogoBox}>
                      <Text style={styles.paymeBigText}>PAYME</Text>
                    </View>
                    <Text style={styles.methodInfoTitle}>Payme orqali to'lov</Text>
                    <Text style={styles.methodInfoDesc}>
                      Payme ilovasidagi hisobingiz orqali bir tugma bilan xavfsiz to'lovni tasdiqlang.
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payme telefon raqamingiz:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="+998 90 123 45 67"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={phoneInput}
                      onChangeText={setPhoneInput}
                    />
                  </View>
                </View>
              )}

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
                activeOpacity={0.8}
                onPress={handlePay}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.payButtonText}>To'lov amalga oshirilmoqda...</Text>
                  </View>
                ) : (
                  <Text style={styles.payButtonText}>
                    To'lash: {Number(price).toLocaleString('uz-UZ')} so'm
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: 260,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  priceContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  originalPriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginLeft: 6,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#5B4DFF',
  },
  pricePeriod: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 4,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    marginTop: 2,
  },
  scrollBody: {
    maxHeight: 480,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  methodTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTabActiveCard: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#EEF2FF',
  },
  methodTabActiveClick: {
    borderColor: '#0073FF',
    backgroundColor: '#EFF6FF',
  },
  methodTabActivePayme: {
    borderColor: '#14B8A6',
    backgroundColor: '#F0FDFA',
  },
  methodTabEmoji: {
    fontSize: 16,
    marginBottom: 2,
  },
  methodTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  methodTabTextActive: {
    color: colors.primary.DEFAULT,
  },
  clickBadgeMini: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clickTextMini: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0073FF',
  },
  paymeBadgeMini: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymeTextMini: {
    fontSize: 12,
    fontWeight: '800',
    color: '#14B8A6',
  },
  tabContent: {
    marginBottom: 16,
  },
  savedCardsWrapper: {
    marginBottom: 14,
  },
  savedCardsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  savedCardsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  newCardTextBtn: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
  },
  savedCardsScrollList: {
    paddingVertical: 2,
    gap: 8,
  },
  savedCardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  savedCardChipActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#EEF2FF',
  },
  savedCardTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savedCardTypeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  savedCardMaskedNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  savedCardMaskedNumberActive: {
    color: colors.primary.DEFAULT,
    fontWeight: '800',
  },
  deleteCardBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  deleteCardBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  virtualCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardChip: {
    width: 32,
    height: 24,
    backgroundColor: '#FCD34D',
    borderRadius: 5,
    padding: 3,
  },
  chipInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#B45309',
    borderRadius: 3,
  },
  cardTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  virtualCardNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 16,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardHolderLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  cardHolderValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
  },
  saveCardToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 8,
    gap: 10,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: colors.primary.DEFAULT,
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: -1,
  },
  saveCardTexts: {
    flex: 1,
  },
  saveCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  saveCardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    lineHeight: 15,
  },
  securityNote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  methodInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clickLogoBox: {
    backgroundColor: '#0073FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
  },
  clickBigText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  paymeLogoBox: {
    backgroundColor: '#14B8A6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
  },
  paymeBigText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  methodInfoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  methodInfoDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  payButton: {
    backgroundColor: colors.primary.DEFAULT,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 8,
    marginBottom: 12,
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successBox: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 54,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#059669',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
});
