import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme.js';

export default function CircularProgress({
  size = 54,
  strokeWidth = 5,
  percent = 80,
  color = colors.primary.DEFAULT,
  trackColor = '#E0F2FE',
  showText = true,
  textColor = colors.text.primary,
}) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: trackColor,
        },
      ]}
    >
      {/* Active colored arc overlay simulation */}
      <View
        style={[
          styles.innerRing,
          {
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderBottomColor: percent < 50 ? 'transparent' : color,
            borderLeftColor: percent < 25 ? 'transparent' : color,
          },
        ]}
      />
      {showText && (
        <Text style={[styles.text, { color: textColor }]}>
          {percent}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  innerRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    transform: [{ rotateZ: '-45deg' }],
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
  },
});
