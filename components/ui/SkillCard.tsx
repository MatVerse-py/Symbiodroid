import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { StatusBadge } from './StatusBadge';

interface SkillCardProps {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  status: 'active' | 'beta' | 'coming';
  color: string;
  uses: number;
  onPress?: () => void;
}

export function SkillCard({ name, icon, description, category, status, color, uses, onPress }: SkillCardProps) {
  const isDisabled = status === 'coming';

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && !isDisabled && styles.cardPressed,
        isDisabled && styles.cardDisabled,
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}15`, borderColor: `${color}25` }]}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={isDisabled ? Colors.textTertiary : color} />
        </View>
        <StatusBadge status={status} />
      </View>

      <Text style={[styles.name, isDisabled && styles.nameDisabled]}>{name}</Text>
      <Text style={styles.category}>{category.toUpperCase()}</Text>
      <Text style={styles.description} numberOfLines={2}>{description}</Text>

      {uses > 0 ? (
        <View style={styles.footer}>
          <Ionicons name="flash" size={10} color={Colors.textTertiary} />
          <Text style={styles.uses}>{uses} execuções</Text>
        </View>
      ) : null}

      {status === 'coming' && (
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>EM DESENVOLVIMENTO</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flex: 1,
    minWidth: 150,
  },
  cardPressed: {
    backgroundColor: Colors.surface2,
    transform: [{ scale: 0.98 }],
  },
  cardDisabled: {
    opacity: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  nameDisabled: { color: Colors.textTertiary },
  category: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  description: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  uses: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  comingSoon: {
    backgroundColor: Colors.surface3,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  comingSoonText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
});
