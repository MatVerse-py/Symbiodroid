import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: 'green' | 'gold' | 'cyan' | 'none';
  padding?: number;
}

export function GlassCard({ children, style, accent = 'none', padding = Spacing.md }: GlassCardProps) {
  const borderColor = {
    green: Colors.primaryBorder,
    gold: Colors.borderGold,
    cyan: 'rgba(0,229,255,0.2)',
    none: Colors.border,
  }[accent];

  return (
    <View style={[styles.card, { borderColor, padding }, style]}>
      {accent !== 'none' && (
        <View style={[styles.accentLine, {
          backgroundColor: accent === 'green' ? Colors.primary
            : accent === 'gold' ? Colors.gold
            : Colors.cyan,
        }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface1,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
});
