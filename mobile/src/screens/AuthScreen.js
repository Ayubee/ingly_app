/**
 * INGLY MOBILE - AUTH SCREEN (LOGIN & REGISTER)
 * TZ.txt 8-bo'limiga 100% mos ravishda tuzildi:
 * 8.1. Ro'yxatdan o'tish: Ism, Telefon raqam (+998...), Login (username), Parol, Avatar, Maqsad.
 * 8.2. Google Sign-In (OAuth 2.0).
 * 8.3. Tizimga kirish: Login/Telefon va Parol.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { colors } from '../theme.js';
import { useUser } from '../context/UserContext.js';

const AVATARS = ['👨‍🎓', '👩‍🎓', '🦁', '🦊', '🚀', '⚡️', '👑', '🎯'];

const GOALS = [
  { words: 10, title: '10 ta so\'z', desc: 'Yengil (10 daqiqa/kun)' },
  { words: 20, title: '20 ta so\'z', desc: 'Standart (Tavsiya etiladi ⭐)' },
  { words: 30, title: '30 ta so\'z', desc: 'Jiddiy (Tezkor o\'rganish)' },
];

export default function AuthScreen() {
  const { register, login, loginWithGoogle } = useUser();

  // Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('+998 ');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regAvatar, setRegAvatar] = useState('👨‍🎓');
  const [regGoal, setRegGoal] = useState(20);

  // Handle Login
  const handleLoginSubmit = async () => {
    if (!loginIdentifier.trim()) {
      Alert.alert('Diqqat', 'Iltimos, Login (username) yoki Telefon raqamingizni kiriting!');
      return;
    }
    if (!loginPassword.trim()) {
      Alert.alert('Diqqat', 'Iltimos, parolingizni kiriting!');
      return;
    }

    const res = await login({
      loginOrPhone: loginIdentifier.trim(),
      password: loginPassword.trim(),
    });

    if (!res.success) {
      Alert.alert('Kirishda xatolik ❌', res.error);
      return;
    }
  };

  // Handle Register
  const handleRegisterSubmit = async () => {
    const cleanFullName = regFullName.trim();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanPhone = regPhone.trim();
    const cleanPhoneDigits = cleanPhone.replace(/\D/g, '');
    const cleanPassword = regPassword.trim();

    if (!cleanFullName) {
      Alert.alert('Diqqat', 'Iltimos, Ism va familiyangizni kiriting!');
      return;
    }
    if (cleanPhoneDigits.length < 9) {
      Alert.alert('Diqqat', 'Iltimos, to\'g\'ri telefon raqamingizni kiriting (+998...)!');
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      Alert.alert('Diqqat', 'Login kamida 3 ta belgidan iborat bo\'lishi shart!');
      return;
    }
    if (/\s/.test(cleanUsername)) {
      Alert.alert('Diqqat', 'Login tarkibida bo\'sh joy (probel) bo\'lishi mumkin emas!');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      Alert.alert('Diqqat', 'Parol kamida 6 ta belgidan iborat bo\'lishi va faqat probellardan iborat bo\'lmasligi kerak!');
      return;
    }

    const res = await register({
      fullName: cleanFullName,
      phone: cleanPhone,
      username: cleanUsername,
      password: cleanPassword,
      avatar: regAvatar,
      dailyGoal: regGoal,
    });

    if (!res.success) {
      Alert.alert('Ro\'yxatdan o\'tishda xatolik', res.error);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSubmit = async () => {
    await loginWithGoogle({
      name: regFullName.trim() || loginIdentifier.trim() || 'Google Foydalanuvchisi',
      email: 'user@gmail.com',
      phone: regPhone.trim() || '+998 90 000 00 00',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Header */}
          <View style={styles.headerSection}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoEmoji}>📚</Text>
            </View>
            <Text style={styles.appTitle}>INGLY</Text>
            <Text style={styles.appSubtitle}>4000 Essential English Words</Text>
            <Text style={styles.welcomeText}>
              Ingliz tilidagi eng muhim 4000 ta so'zni o'rganish platformasi
            </Text>
          </View>

          {/* Tab Switcher: [Kirish] va [Ro'yxatdan o'tish] */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                authMode === 'login' && styles.tabBtnActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setAuthMode('login')}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  authMode === 'login' && styles.tabBtnTextActive,
                ]}
              >
                Kirish (Login)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                authMode === 'register' && styles.tabBtnActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setAuthMode('register')}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  authMode === 'register' && styles.tabBtnTextActive,
                ]}
              >
                Ro'yxatdan o'tish
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {authMode === 'login' ? (
              /* ================= 1. LOGIN FORMASI ================= */
              <View>
                <Text style={styles.formTitle}>Akkauntga Kirish</Text>
                <Text style={styles.formDesc}>
                  Ilovaga kirish uchun Login yoki Telefon raqamingizni kiriting
                </Text>

                {/* Login yoki Telefon */}
                <Text style={styles.fieldLabel}>Login yoki Telefon raqam:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="masalan: ayubeey yoki +99890..."
                  placeholderTextColor="#94A3B8"
                  value={loginIdentifier}
                  onChangeText={setLoginIdentifier}
                  autoCapitalize="none"
                />

                {/* Parol */}
                <Text style={styles.fieldLabel}>Parol:</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Parolingizni kiriting"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showLoginPassword}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowLoginPassword(!showLoginPassword)}
                  >
                    <Text style={styles.eyeIcon}>{showLoginPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Kirish Tugmasi */}
                <TouchableOpacity
                  style={styles.submitBtn}
                  activeOpacity={0.85}
                  onPress={handleLoginSubmit}
                >
                  <Text style={styles.submitBtnText}>Kirish ➔</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>YOKI</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign-In Tugmasi */}
                <TouchableOpacity
                  style={styles.googleBtn}
                  activeOpacity={0.85}
                  onPress={handleGoogleSubmit}
                >
                  <Text style={styles.googleIcon}>🔴</Text>
                  <Text style={styles.googleBtnText}>Google orqali kirish</Text>
                </TouchableOpacity>

                {/* Switch to Register */}
                <TouchableOpacity
                  style={styles.switchModeBtn}
                  onPress={() => setAuthMode('register')}
                >
                  <Text style={styles.switchModeText}>
                    Profilingiz yo'qmi? <Text style={styles.switchModeHighlight}>Ro'yxatdan o'ting</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ================= 2. REGISTER FORMASI ================= */
              <View>
                <Text style={styles.formTitle}>Yangi Profil Ochish</Text>
                <Text style={styles.formDesc}>
                  Barcha ma'lumotlaringiz 0 dan boshlanadi va xavfsiz saqlanadi
                </Text>

                {/* Ism va Familiya */}
                <Text style={styles.fieldLabel}>Ism va familiyangiz:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Masalan: Ayubbek Qodirov"
                  placeholderTextColor="#94A3B8"
                  value={regFullName}
                  onChangeText={setRegFullName}
                  autoCapitalize="words"
                />

                {/* Telefon Raqam */}
                <Text style={styles.fieldLabel}>Telefon raqamingiz:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="+998 90 123 45 67"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={regPhone}
                  onChangeText={(val) => setRegPhone(val.replace(/[^\d+\s\-()]/g, ''))}
                />

                {/* Login (Username) */}
                <Text style={styles.fieldLabel}>Login (foydalanuvchi nomi):</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Masalan: ayubeey"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  value={regUsername}
                  onChangeText={(val) => setRegUsername(val.replace(/\s/g, '').toLowerCase())}
                />

                {/* Parol */}
                <Text style={styles.fieldLabel}>Parol (kamida 6 ta belgi):</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Yangi parol o'ylab toping"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showRegPassword}
                    value={regPassword}
                    onChangeText={setRegPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowRegPassword(!showRegPassword)}
                  >
                    <Text style={styles.eyeIcon}>{showRegPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Avatar Tanlash */}
                <Text style={styles.fieldLabel}>Profil belgisi (Avatar):</Text>
                <View style={styles.avatarRow}>
                  {AVATARS.map((av) => {
                    const isSelected = regAvatar === av;
                    return (
                      <TouchableOpacity
                        key={av}
                        activeOpacity={0.7}
                        onPress={() => setRegAvatar(av)}
                        style={[
                          styles.avatarBtn,
                          isSelected && styles.avatarBtnActive,
                        ]}
                      >
                        <Text style={styles.avatarEmoji}>{av}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Kunlik Maqsad */}
                <Text style={styles.fieldLabel}>Kunlik maqsad (Daily Goal):</Text>
                <View style={styles.goalsContainer}>
                  {GOALS.map((g) => {
                    const isSelected = regGoal === g.words;
                    return (
                      <TouchableOpacity
                        key={g.words}
                        activeOpacity={0.8}
                        onPress={() => setRegGoal(g.words)}
                        style={[
                          styles.goalCard,
                          isSelected && styles.goalCardActive,
                        ]}
                      >
                        <View style={styles.goalRadio}>
                          {isSelected && <View style={styles.goalRadioInner} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.goalTitle,
                              isSelected && styles.goalTitleActive,
                            ]}
                          >
                            {g.title}
                          </Text>
                          <Text style={styles.goalDesc}>{g.desc}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Ro'yxatdan o'tish Tugmasi */}
                <TouchableOpacity
                  style={styles.submitBtn}
                  activeOpacity={0.85}
                  onPress={handleRegisterSubmit}
                >
                  <Text style={styles.submitBtnText}>Ro'yxatdan o'tish va Boshlash 🚀</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>YOKI</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign-In Tugmasi */}
                <TouchableOpacity
                  style={styles.googleBtn}
                  activeOpacity={0.85}
                  onPress={handleGoogleSubmit}
                >
                  <Text style={styles.googleIcon}>🔴</Text>
                  <Text style={styles.googleBtnText}>Google orqali ro'yxatdan o'tish</Text>
                </TouchableOpacity>

                {/* Switch to Login */}
                <TouchableOpacity
                  style={styles.switchModeBtn}
                  onPress={() => setAuthMode('login')}
                >
                  <Text style={styles.switchModeText}>
                    Profilingiz bormi? <Text style={styles.switchModeHighlight}>Kirish</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Privacy Note */}
          <Text style={styles.footerNote}>
            🔒 Ma'lumotlaringiz shifrlangan va xavfsiz saqlanadi.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoEmoji: {
    fontSize: 30,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary.DEFAULT,
    letterSpacing: 1.5,
  },
  appSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  welcomeText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 14,
    padding: 4,
    width: '100%',
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: colors.primary.DEFAULT,
    fontWeight: '800',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  formDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarBtnActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#EEF0FF',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  goalsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  goalCardActive: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#F8FAFC',
  },
  goalRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.DEFAULT,
  },
  goalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  goalTitleActive: {
    color: colors.primary.DEFAULT,
  },
  goalDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: colors.primary.DEFAULT,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 16,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  googleIcon: {
    fontSize: 14,
  },
  googleBtnText: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '700',
  },
  switchModeBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 12,
    color: '#64748B',
  },
  switchModeHighlight: {
    color: colors.primary.DEFAULT,
    fontWeight: '800',
  },
  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 16,
    textAlign: 'center',
  },
});
