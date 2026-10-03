/**
 * INGLY MOBILE DESIGN SYSTEM - PROGRESS BAR COMPONENT (React Native)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme.js';

export default function ProgressBar({
  progress = 45, // 0 - 100
  height = 8,
  showLabel = true,
  color = colors.primary.DEFAULT,
  trackColor = colors.border.DEFAULT,
}) {
  const clamped = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>O'zlashtirish darajasi</Text>
          <Text style={[styles.percentText, { color }]}>{clamped}%</Text>
        </View>
      )}

      <View style={[styles.track, { height, backgroundColor: trackColor }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clamped}%`,
              backgroundColor: color,
              height,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  track: {
    width: '100%',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 9999,
  },
});
