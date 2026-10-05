import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme.js';
import { useLanguage } from '../context/LanguageContext.js';

export default function BottomNavigation({ currentTab, onSelectTab }) {
  const { t } = useLanguage();

  const tabs = [
    { id: 'Home', label: t('nav_home', 'Home'), icon: '🏠' },
    { id: 'Learn', label: t('nav_learn', 'Learn'), icon: '📖' },
    { id: 'Leaderboard', label: t('nav_leaderboard', 'Reyting'), icon: '🏆' },
    { id: 'MyWords', label: t('nav_my_words', 'Lug\'atim'), icon: '✍️' },
    { id: 'Flashcards', label: t('nav_cards', 'Kartalar'), icon: '🎴' },
    { id: 'Quiz', label: t('nav_quiz', 'Test'), icon: '🎯' },
    { id: 'Profile', label: t('nav_profile', 'Profil'), icon: '👤' },
  ];

  return (
    <View style={styles.navBar}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.7}
            onPress={() => onSelectTab(tab.id)}
            style={styles.tabItem}
          >
            <Text style={[styles.tabIcon, isActive && styles.activeIcon]}>
              {tab.icon}
            </Text>
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.activeLabel : styles.inactiveLabel,
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    height: Platform.OS === 'ios' ? 82 : 64,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    paddingTop: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    paddingHorizontal: 0,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  activeIcon: {
    transform: [{ scale: 1.15 }],
  },
  tabLabel: {
    fontSize: 8.8,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeLabel: {
    color: colors.primary.DEFAULT,
    fontWeight: '800',
  },
  inactiveLabel: {
    color: '#64748B',
  },
});
