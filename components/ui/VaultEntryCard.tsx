import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { VaultEntry } from '@/services/vaultService';

const CATEGORY_CONFIG = {
  key: { icon: 'key', color: Colors.gold },
  doc: { icon: 'document-text', color: Colors.cyan },
  note: { icon: 'clipboard', color: Colors.purple },
  credential: { icon: 'shield', color: Colors.primary },
  code: { icon: 'code-slash', color: '#FF8C00' },
} as const;

interface VaultEntryCardProps {
  entry: VaultEntry;
  locked: boolean;
  onDelete?: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function VaultEntryCard({ entry, locked, onDelete }: VaultEntryCardProps) {
  const config = CATEGORY_CONFIG[entry.category];

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: `${config.color}15` }]}>
          <Ionicons name={config.icon as keyof typeof Ionicons.glyphMap} size={18} color={config.color} />
        </View>
      </View>

      <View style={styles.center}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{entry.title}</Text>
          {entry.encrypted ? (
            <Ionicons name="lock-closed" size={10} color={Colors.primary} />
          ) : null}
        </View>

        <Text style={styles.preview} numberOfLines={1}>
          {locked ? '••••••••••••••••••••' : entry.preview}
        </Text>

        <View style={styles.meta}>
          <Text style={styles.size}>{entry.size}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.date}>{formatDate(entry.updatedAt)}</Text>
          {entry.tags.slice(0, 2).map(tag => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {onDelete ? (
        <Pressable
          onPress={() => onDelete(entry.id)}
          hitSlop={8}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="trash-outline" size={14} color={Colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 12,
  },
  left: {},
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  preview: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  size: { fontSize: 10, color: Colors.textTertiary },
  dot: { fontSize: 10, color: Colors.textTertiary },
  date: { fontSize: 10, color: Colors.textTertiary },
  tag: {
    backgroundColor: Colors.surface3,
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagText: { fontSize: 9, color: Colors.textTertiary },
  deleteBtn: {
    padding: 6,
  },
});
