import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface OmegaGateIndicatorProps {
  isActive: boolean;
  currentStep?: string;
  stepIndex?: number;
  totalSteps?: number;
}

export function OmegaGateIndicator({ isActive, currentStep, stepIndex = 0, totalSteps = 5 }: OmegaGateIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [isActive]);

  useEffect(() => {
    const progress = totalSteps > 0 ? stepIndex / totalSteps : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [stepIndex, totalSteps]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Animated.View style={[styles.dot, { opacity: isActive ? pulseAnim : 1 }, isActive ? styles.dotActive : styles.dotIdle]} />
          <Text style={styles.title}>Ω-GATE</Text>
        </View>
        <Text style={[styles.status, { color: isActive ? Colors.gold : Colors.primary }]}>
          {isActive ? 'EXECUTANDO' : 'STANDBY'}
        </Text>
      </View>

      {isActive && currentStep ? (
        <>
          <Text style={styles.step} numberOfLines={1}>{currentStep}</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.stepCount}>{stepIndex}/{totalSteps} etapas</Text>
        </>
      ) : (
        <Text style={styles.idle}>Aguardando comando seguro...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: { backgroundColor: Colors.gold },
  dotIdle: { backgroundColor: Colors.primary },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  status: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  step: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.surface3,
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 1,
  },
  stepCount: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  idle: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
});
