import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

type StatusType = 'active' | 'beta' | 'coming' | 'pass' | 'block' | 'running' | 'done';

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<StatusType, { label: string; bg: string; text: string }> = {
  active: { label: 'ATIVO', bg: 'rgba(0,255,148,0.12)', text: Colors.primary },
  beta: { label: 'BETA', bg: 'rgba(0,229,255,0.12)', text: Colors.cyan },
  coming: { label: 'EM BREVE', bg: 'rgba(255,140,0,0.12)', text: Colors.orange },
  pass: { label: 'PASS', bg: 'rgba(0,255,148,0.12)', text: Colors.primary },
  block: { label: 'BLOCK', bg: 'rgba(255,68,68,0.12)', text: Colors.red },
  running: { label: 'RUNNING', bg: 'rgba(255,215,0,0.12)', text: Colors.gold },
  done: { label: 'DONE', bg: 'rgba(0,255,148,0.12)', text: Colors.primary },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSmall ? styles.sm : styles.md]}>
      <Text style={[styles.text, { color: config.text }, isSmall ? styles.textSm : styles.textMd]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textSm: { fontSize: 9 },
  textMd: { fontSize: 11 },
});
