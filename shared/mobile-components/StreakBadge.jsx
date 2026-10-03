/**
 * INGLY MOBILE DESIGN SYSTEM - STREAK BADGE COMPONENT (React Native)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme.js';

export default function StreakBadge({ streakCount = 7 }) {
  return (
    <View style={styles.badgeContainer}>
      <Text style={styles.flameIcon}>🔥</Text>
      <Text style={styles.countText}>{streakCount}</Text>
      <Text style={styles.labelText}>kun</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.streakBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 4,
  },
  flameIcon: {
    fontSize: 14,
  },
  countText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.status.streak,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.status.streak,
  },
});
