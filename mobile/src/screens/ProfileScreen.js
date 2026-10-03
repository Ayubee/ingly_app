/**
 * INGLY MOBILE - PROFILE & SETTINGS SCREEN
 * Shaxsiy profilni tahrirlash (ism, avatar/rasm), kunlik maqsad,
 * bildirishnomalar va natijalarni 0 dan boshlash.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import { colors } from '../theme.js';
import { useUser } from '../context/UserContext.js';

const AVAILABLE_AVATARS = ['👨‍🎓', '👩‍🎓', '🦁', '🦊', '🚀', '⚡️', '👑', '🎯', '🦉', '🌟'];
const REMINDER_TIMES = ['08:00', '13:00', '19:00', '21:00'];

export default function ProfileScreen({ onNavigate }) {
  const { user, updateProfile, resetProgress, logout } = useUser();

  // Edit Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editAvatar, setEditAvatar] = useState(user.avatar || '👨‍🎓');

  // Open Edit Modal
  const openEditModal = () => {
    setEditName(user.name);
    setEditPhone(user.phone || '');
    setEditAvatar(user.avatar || '👨‍🎓');
    setIsEditModalVisible(true);
  };

  // Save Profile Edits
  const handleSaveProfile = async () => {
    const cleanName = editName.trim();
    if (!cleanName) {
      Alert.alert('Xato', 'Ism bo\'sh bo\'lishi yoki faqat probellardan iborat bo\'lishi mumkin emas!');
      return;
    }

    const sanitizedPhone = editPhone.replace(/[^\d+\s\-()]/g, '').trim();
    const phoneDigits = sanitizedPhone.replace(/\D/g, '');
    if (sanitizedPhone && phoneDigits.length < 9) {
      Alert.alert('Xato', 'Telefon raqam kamida 9 ta raqamdan iborat bo\'lishi kerak!');
      return;
    }

    const res = await updateProfile({
      name: cleanName,
      phone: sanitizedPhone,
      avatar: editAvatar,
    });

    if (res && res.success === false) {
      Alert.alert('Xato', res.error || 'Profilni saqlashda xatolik yuz berdi');
      return;
    }

    setIsEditModalVisible(false);
    Alert.alert('Muvaffaqiyatli', 'Profil ma\'lumotlari yangilandi!');
  };

  // Kunlik maqsadni o'zgartirish (0 ga teng bo'lishidan himoyalangan)
  const handleGoalChange = (wordsCount) => {
    updateProfile({ dailyGoal: Number(wordsCount) || 20 });
  };

  // Eslatma vaqtini o'zgartirish
  const handleReminderChange = (time) => {
    updateProfile({ reminderTime: time });
  };

  // Progressni tozalash
  const handleResetConfirm = () => {
    Alert.alert(
      'Natijalarni tozalash',
      'Haqiqatan ham barcha o\'rganilgan so\'zlar va natijalarni 0 ga qaytarmoqchimisiz?',
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'Ha, tozalansin',
          style: 'destructive',
          onPress: () => {
            resetProgress();
            Alert.alert('Tayyor', 'Barcha natijalar 0 ga qaytarildi!');
          },
        },
      ]
    );
  };

  // Hisobdan chiqish
  const handleLogoutConfirm = () => {
    Alert.alert(
      'Hisobdan chiqish',
      'Chiqishni xohlaysizmi? Siz qaytadan profil yaratishingiz yoki kirishingiz mumkin bo\'ladi.',
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'Chiqish',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Header */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openEditModal}
            style={styles.avatarBorder}
          >
            <Text style={styles.avatarEmoji}>{user.avatar || '👨‍🎓'}</Text>
            <View style={styles.editBadgeCircle}>
              <Text style={styles.editBadgeIcon}>✏️</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{user.name || 'O\'quvchi'}</Text>
          <Text style={styles.userHandle}>
            {user.username ? `@${user.username}` : ''} {user.phone ? `• ${user.phone}` : ''}
          </Text>

          {/* Quick Badges */}
          <View style={styles.authBadgeRow}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>
                {user.streakDays > 0 ? `🔥 ${user.streakDays} kunlik streak` : '🔥 0 kun streak'}
              </Text>
            </View>
            <View style={styles.methodBadge}>
              <Text style={styles.methodBadgeText}>
                {user.authMethod === 'google' ? '🔴 Google' : '🔑 Parol'}
              </Text>
            </View>
          </View>

          {/* Quick Action: Tahrirlash tugmasi */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openEditModal}
            style={styles.editProfileBtn}
          >
            <Text style={styles.editProfileBtnText}>Profilni tahrirlash ✏️</Text>
          </TouchableOpacity>
        </View>

        {/* 1. O'rganish Statistikasi (Haqiqiy raqamlar) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>O'rganish Statistikasi</Text>
            <Text style={styles.bookActiveBadge}>Book {user.activeBook}</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{user.totalWordsLearned}</Text>
              <Text style={styles.statLabel}>Yodlangan so'zlar</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#0EA5E9' }]}>
                {user.reviewedWordsCount}
              </Text>
              <Text style={styles.statLabel}>Takrorlashda</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#EF4444' }]}>
                {user.hardWordsCount}
              </Text>
              <Text style={styles.statLabel}>Qiyin so'zlar</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#F97316' }]}>
                {user.accuracy}%
              </Text>
              <Text style={styles.statLabel}>O'rtacha aniqlik</Text>
            </View>
          </View>
        </View>

        {/* 2. Kunlik Maqsad Sozlamalari */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Kunlik Maqsad (Daily Goal)</Text>
          <Text style={styles.sectionSubtitle}>
            Har kuni o'rganishni rejalashtirgan so'zlar sonini tanlang:
          </Text>

          <View style={styles.goalOptionsRow}>
            {[10, 20, 30, 50].map((count) => {
              const isSelected = user.dailyGoal === count;
              return (
                <TouchableOpacity
                  key={count}
                  activeOpacity={0.8}
                  onPress={() => handleGoalChange(count)}
                  style={[
                    styles.goalOptionBtn,
                    isSelected && styles.goalOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      isSelected && styles.goalOptionTextActive,
                    ]}
                  >
                    {count} ta
                  </Text>
                  <Text
                    style={[
                      styles.goalSubtext,
                      isSelected && styles.goalSubtextActive,
                    ]}
                  >
                    so'z/kun
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Bildirishnomalar va Eslatma Vaqti */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Kunlik Eslatmalar</Text>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.settingLabel}>Push-xabarlar</Text>
              <Text style={styles.settingSubtext}>
                Mahalliy vaqtingiz bo'yicha eslatma yuborish
              </Text>
            </View>
            <Switch
              value={user.notificationsEnabled}
              onValueChange={(val) => updateProfile({ notificationsEnabled: val })}
              trackColor={{ false: '#CBD5E1', true: colors.primary.DEFAULT }}
              thumbColor="#FFFFFF"
            />
          </View>

          {user.notificationsEnabled && (
            <View style={styles.reminderSection}>
              <Text style={styles.reminderSubtitle}>Eslatma vaqtini tanlang:</Text>
              <View style={styles.timeRow}>
                {REMINDER_TIMES.map((time) => {
                  const isSelected = user.reminderTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      activeOpacity={0.8}
                      onPress={() => handleReminderChange(time)}
                      style={[
                        styles.timeBtn,
                        isSelected && styles.timeBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeBtnText,
                          isSelected && styles.timeBtnTextActive,
                        ]}
                      >
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={[styles.switchRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }]}>
            <View>
              <Text style={styles.settingLabel}>Tovush effektlari</Text>
              <Text style={styles.settingSubtext}>Talaffuz va test bosish ovozlari</Text>
            </View>
            <Switch
              value={user.soundEnabled}
              onValueChange={(val) => updateProfile({ soundEnabled: val })}
              trackColor={{ false: '#CBD5E1', true: colors.primary.DEFAULT }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* 4. Amallar & Tozalash */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Boshqaruv</Text>

          {/* Reset progress */}
          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={handleResetConfirm}
          >
            <Text style={styles.actionIcon}>🔄</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Natijalarni 0 ga qaytarish</Text>
              <Text style={styles.actionSubtitle}>Barcha o'rganilgan so'zlarni tozalash</Text>
            </View>
            <Text style={styles.chevron}>➔</Text>
          </TouchableOpacity>

          {/* Log out */}
          <TouchableOpacity
            style={[styles.actionRow, { borderBottomWidth: 0, marginTop: 4 }]}
            activeOpacity={0.7}
            onPress={handleLogoutConfirm}
          >
            <Text style={styles.actionIcon}>🚪</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: '#EF4444' }]}>
                Hisobdan chiqish
              </Text>
              <Text style={styles.actionSubtitle}>Yangi profil yaratish yoki almashish</Text>
            </View>
            <Text style={[styles.chevron, { color: '#EF4444' }]}>➔</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Profilni Tahrirlash Modal Aynasi */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setIsEditModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Profilni Tahrirlash</Text>
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setIsEditModalVisible(false);
                      }}
                      style={styles.closeBtnBox}
                    >
                      <Text style={styles.modalCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 10 }}
                  >
                    {/* Ism kiritish */}
                    <Text style={styles.modalLabel}>Ismingiz:</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Ismingizni kiriting"
                      placeholderTextColor="#94A3B8"
                      maxLength={25}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />

                    {/* Telefon raqam */}
                    <View style={styles.phoneLabelRow}>
                      <Text style={styles.modalLabel}>Telefon raqamingiz:</Text>
                      <TouchableOpacity
                        onPress={Keyboard.dismiss}
                        style={styles.dismissKbdBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dismissKbdText}>Klaviaturani yopish ✕</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.modalInput}
                      value={editPhone}
                      onChangeText={(val) => setEditPhone(val.replace(/[^\d+\s\-()]/g, ''))}
                      placeholder="+998 90 123 45 67"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />

                    {/* Avatar tanlash */}
                    <Text style={styles.modalLabel}>Avatar belgisini tanlang:</Text>
                    <View style={styles.avatarSelectionRow}>
                      {AVAILABLE_AVATARS.map((av) => {
                        const isSelected = editAvatar === av;
                        return (
                          <TouchableOpacity
                            key={av}
                            activeOpacity={0.7}
                            onPress={() => {
                              Keyboard.dismiss();
                              setEditAvatar(av);
                            }}
                            style={[
                              styles.avatarPickBtn,
                              isSelected && styles.avatarPickBtnActive,
                            ]}
                          >
                            <Text style={styles.avatarPickEmoji}>{av}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Save & Cancel Buttons - Har doim ko'rinib turadigan barqaror panel */}
                  <View style={styles.modalActionsRow}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        Keyboard.dismiss();
                        setIsEditModalVisible(false);
                      }}
                    >
                      <Text style={styles.modalCancelText}>Bekor qilish</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalSaveBtn}
                      activeOpacity={0.85}
                      onPress={() => {
                        Keyboard.dismiss();
                        handleSaveProfile();
                      }}
                    >
                      <Text style={styles.modalSaveText}>Saqlash ✓</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  profileCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  avatarBorder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary.DEFAULT,
    position: 'relative',
    marginBottom: 12,
  },
  avatarEmoji: {
    fontSize: 44,
  },
  editBadgeCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editBadgeIcon: {
    fontSize: 12,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  userHandle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  authBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  streakBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  streakBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  methodBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  methodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  editProfileBtn: {
    marginTop: 14,
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.DEFAULT,
  },
  sectionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  bookActiveBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary.DEFAULT,
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary.DEFAULT,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  goalOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  goalOptionBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  goalOptionActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#EEF0FF',
  },
  goalOptionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  goalOptionTextActive: {
    color: colors.primary.DEFAULT,
  },
  goalSubtext: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  goalSubtextActive: {
    color: colors.primary.DEFAULT,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  settingSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  reminderSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  reminderSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  timeBtnActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: colors.primary.DEFAULT,
  },
  timeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  timeBtnTextActive: {
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  chevron: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '800',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtnBox: {
    padding: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
  },
  phoneLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  dismissKbdBtn: {
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dismissKbdText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.DEFAULT,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  avatarSelectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  avatarPickBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarPickBtnActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#EEF0FF',
  },
  avatarPickEmoji: {
    fontSize: 24,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
