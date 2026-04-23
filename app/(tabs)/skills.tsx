import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { SkillCard } from '@/components';
import { SkillsConfig } from '@/constants/config';
import { useRouter } from 'expo-router';

const CATEGORIES = ['Todos', 'Desenvolvimento', 'Segurança', 'Negócios', 'Análise', 'Infraestrutura', 'Automação'];

export default function SkillsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedSkill, setSelectedSkill] = useState<typeof SkillsConfig[0] | null>(null);

  const filtered = selectedCategory === 'Todos'
    ? SkillsConfig
    : SkillsConfig.filter(s => s.category === selectedCategory);

  const active = SkillsConfig.filter(s => s.status === 'active').length;
  const beta = SkillsConfig.filter(s => s.status === 'beta').length;
  const coming = SkillsConfig.filter(s => s.status === 'coming').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>SKILLS</Text>
          <Text style={styles.subtitle}>Módulos de capacidade do agente</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: Colors.primary }]}>{active}</Text>
            <Text style={styles.statLabel}>ativos</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: Colors.cyan }]}>{beta}</Text>
            <Text style={styles.statLabel}>beta</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: Colors.orange }]}>{coming}</Text>
            <Text style={styles.statLabel}>breve</Text>
          </View>
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Skills Grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        <View style={styles.gridRow}>
          {filtered.map((skill, i) => (
            <SkillCard
              key={skill.id}
              {...skill}
              status={skill.status as 'active' | 'beta' | 'coming'}
              onPress={() => {
                if (skill.status !== 'coming') setSelectedSkill(skill);
              }}
            />
          ))}
          {filtered.length % 2 !== 0 && <View style={styles.gridPlaceholder} />}
        </View>

        {/* Add Skill CTA */}
        <Pressable style={({ pressed }) => [styles.addCard, pressed && { opacity: 0.7 }]}>
          <Ionicons name="add-circle-outline" size={28} color={Colors.textTertiary} />
          <Text style={styles.addText}>Adicionar Skill</Text>
          <Text style={styles.addSubText}>Marketplace em breve</Text>
        </Pressable>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Skill Detail Modal */}
      <Modal
        visible={selectedSkill !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSkill(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedSkill(null)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            {selectedSkill ? (
              <>
                <View style={styles.modalHandle} />
                <View style={[styles.modalIcon, { backgroundColor: `${selectedSkill.color}15` }]}>
                  <Ionicons
                    name={selectedSkill.icon as keyof typeof Ionicons.glyphMap}
                    size={36}
                    color={selectedSkill.color}
                  />
                </View>
                <Text style={styles.modalName}>{selectedSkill.name}</Text>
                <Text style={styles.modalCategory}>{selectedSkill.category.toUpperCase()}</Text>
                <Text style={styles.modalDesc}>{selectedSkill.description}</Text>

                <View style={styles.modalStats}>
                  <View style={styles.modalStat}>
                    <Text style={[styles.modalStatNum, { color: selectedSkill.color }]}>{selectedSkill.uses}</Text>
                    <Text style={styles.modalStatLabel}>Execuções</Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={[styles.modalStatNum, { color: selectedSkill.color }]}>97.4%</Text>
                    <Text style={styles.modalStatLabel}>Sucesso</Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={[styles.modalStatNum, { color: selectedSkill.color }]}>2.1s</Text>
                    <Text style={styles.modalStatLabel}>Média</Text>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.modalBtn, { backgroundColor: selectedSkill.color }, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    setSelectedSkill(null);
                    router.push('/(tabs)/agent');
                  }}
                >
                  <Ionicons name="flash" size={16} color={Colors.black} />
                  <Text style={styles.modalBtnText}>USAR ESTE SKILL</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface0 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 3 },
  subtitle: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 9, color: Colors.textTertiary, letterSpacing: 0.5 },
  statDiv: { width: 1, height: 24, backgroundColor: Colors.border },

  filterWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterScroll: { gap: 8, padding: 10, paddingHorizontal: Spacing.md },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface1,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primaryBorder,
  },
  filterText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  filterTextActive: { color: Colors.primary, fontWeight: '600' },

  grid: { padding: Spacing.md, gap: Spacing.md },
  gridRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  gridPlaceholder: { flex: 1, minWidth: 150 },

  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.xl,
    gap: 6,
  },
  addText: { fontSize: 14, fontWeight: '600', color: Colors.textTertiary },
  addSubText: { fontSize: 11, color: Colors.textTertiary },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface1,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  modalIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  modalCategory: { fontSize: 10, color: Colors.textTertiary, letterSpacing: 2 },
  modalDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.md },
  modalStats: { flexDirection: 'row', gap: Spacing.xl, marginVertical: Spacing.sm },
  modalStat: { alignItems: 'center', gap: 2 },
  modalStatNum: { fontSize: 22, fontWeight: '700' },
  modalStatLabel: { fontSize: 11, color: Colors.textTertiary },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  modalBtnText: { fontSize: 14, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
});
