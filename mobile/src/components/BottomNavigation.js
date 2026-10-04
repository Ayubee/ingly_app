import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme.js';

export default function BottomNavigation({ currentTab, onSelectTab }) {
  const tabs = [
    { id: 'Home', label: 'Home', icon: '🏠' },
    { id: 'Learn', label: 'Learn', icon: '📖' },
    { id: 'MyWords', label: 'Lug\'atim', icon: '✍️' },
    { id: 'Flashcards', label: 'Kartalar', icon: '🎴' },
    { id: 'Quiz', label: 'Quiz', icon: '🏆' },
    { id: 'Profile', label: 'Profil', icon: '👤' },
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
    height: Platform.OS === 'ios' ? 82 : 66,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingTop: 8,
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
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  activeIcon: {
    transform: [{ scale: 1.12 }],
  },
  tabLabel: {
    fontSize: 9.5,
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
