import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { useVault } from '@/hooks/useVault';
import { VaultEntryCard } from '@/components';
import { getVaultStats } from '@/services/vaultService';
import { VaultEntry } from '@/services/vaultService';
import { useAlert } from '@/template';

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const { entries, isLocked, unlock, lock, removeEntry, searchQuery, setSearchQuery, filteredEntries, addEntry } = useVault();
  const stats = getVaultStats();
  const { showAlert } = useAlert();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<VaultEntry['category']>('note');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [unlockModalVisible, setUnlockModalVisible] = useState(false);

  const MOCK_PIN = '1234';

  const handleUnlock = () => {
    if (pinInput === MOCK_PIN) {
      unlock();
      setUnlockModalVisible(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleDelete = (id: string) => {
    showAlert('Excluir entrada?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removeEntry(id) },
    ]);
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    await addEntry(newTitle.trim(), newContent.trim(), newCategory, [newCategory]);
    setNewTitle('');
    setNewContent('');
    setNewCategory('note');
    setAddModalVisible(false);
  };

  const CATEGORY_OPTIONS: Array<{ value: VaultEntry['category']; label: string; icon: string }> = [
    { value: 'note', label: 'Nota', icon: 'clipboard' },
    { value: 'key', label: 'Chave', icon: 'key' },
    { value: 'doc', label: 'Documento', icon: 'document-text' },
    { value: 'credential', label: 'Credencial', icon: 'shield' },
    { value: 'code', label: 'Código', icon: 'code-slash' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>VAULT</Text>
          <Text style={styles.subtitle}>Armazenamento soberano criptografado</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.lockBtn,
            { backgroundColor: isLocked ? Colors.primaryGlow : Colors.goldGlow },
            pressed && { opacity: 0.7 }
          ]}
          onPress={() => {
            if (isLocked) {
              setUnlockModalVisible(true);
            } else {
              lock();
            }
          }}
        >
          <Ionicons
            name={isLocked ? 'lock-closed' : 'lock-open'}
            size={16}
            color={isLocked ? Colors.primary : Colors.gold}
          />
          <Text style={[styles.lockText, { color: isLocked ? Colors.primary : Colors.gold }]}>
            {isLocked ? 'BLOQUEADO' : 'ABERTO'}
          </Text>
        </Pressable>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats.totalEntries}</Text>
          <Text style={styles.statLabel}>entradas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{stats.encrypted}</Text>
          <Text style={styles.statLabel}>criptografadas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats.totalSize}</Text>
          <Text style={styles.statLabel}>total</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar no vault..."
          placeholderTextColor={Colors.textTertiary}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      {/* Entries */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filteredEntries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="lock-closed-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Vault vazio</Text>
            <Text style={styles.emptySubText}>Adicione seu primeiro segredo</Text>
          </View>
        ) : (
          filteredEntries.map(entry => (
            <VaultEntryCard
              key={entry.id}
              entry={entry}
              locked={isLocked}
              onDelete={isLocked ? undefined : handleDelete}
            />
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 88 },
          pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }
        ]}
        onPress={() => setAddModalVisible(true)}
      >
        <Ionicons name="add" size={24} color={Colors.black} />
      </Pressable>

      {/* Unlock Modal */}
      <Modal
        visible={unlockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnlockModalVisible(false)}
      >
        <View style={styles.unlockOverlay}>
          <View style={[styles.unlockSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Ionicons name="lock-closed" size={40} color={Colors.primary} />
            <Text style={styles.unlockTitle}>DESBLOQUEAR VAULT</Text>
            <Text style={styles.unlockSub}>Digite o PIN para acessar (demo: 1234)</Text>
            <TextInput
              style={[styles.pinInput, pinError && styles.pinInputError]}
              value={pinInput}
              onChangeText={t => { setPinInput(t); setPinError(false); }}
              placeholder="••••"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              textAlign="center"
            />
            {pinError ? (
              <Text style={styles.pinErrorText}>PIN incorreto</Text>
            ) : null}
            <View style={styles.unlockBtns}>
              <Pressable
                style={({ pressed }) => [styles.unlockBtn, styles.unlockBtnCancel, pressed && { opacity: 0.7 }]}
                onPress={() => { setUnlockModalVisible(false); setPinInput(''); setPinError(false); }}
              >
                <Text style={styles.unlockBtnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.unlockBtn, styles.unlockBtnConfirm, pressed && { opacity: 0.8 }]}
                onPress={handleUnlock}
              >
                <Text style={styles.unlockBtnConfirmText}>Desbloquear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Entry Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
            <View style={[styles.addSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.addTitle}>NOVA ENTRADA</Text>

              <TextInput
                style={styles.addInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Título"
                placeholderTextColor={Colors.textTertiary}
              />

              <TextInput
                style={[styles.addInput, styles.addInputMulti]}
                value={newContent}
                onChangeText={setNewContent}
                placeholder="Conteúdo secreto..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Category Selector */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
                {CATEGORY_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.value}
                    style={[styles.catChip, newCategory === opt.value && styles.catChipActive]}
                    onPress={() => setNewCategory(opt.value)}
                  >
                    <Ionicons
                      name={opt.icon as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={newCategory === opt.value ? Colors.primary : Colors.textTertiary}
                    />
                    <Text style={[styles.catLabel, newCategory === opt.value && styles.catLabelActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                style={({ pressed }) => [styles.addBtn, (!newTitle.trim() || !newContent.trim()) && styles.addBtnDisabled, pressed && { opacity: 0.8 }]}
                onPress={handleAdd}
                disabled={!newTitle.trim() || !newContent.trim()}
              >
                <Ionicons name="shield-checkmark" size={16} color={Colors.black} />
                <Text style={styles.addBtnText}>SALVAR NO VAULT</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
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
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  lockText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  statsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 9, color: Colors.textTertiary, letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: Spacing.md,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },

  list: { paddingHorizontal: Spacing.md, gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: 13, color: Colors.textTertiary },

  fab: {
    position: 'absolute',
    right: Spacing.md,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  unlockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  unlockSheet: {
    backgroundColor: Colors.surface1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  unlockTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },
  unlockSub: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center' },
  pinInput: {
    width: '60%',
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: 24,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    letterSpacing: 8,
  },
  pinInputError: { borderColor: Colors.red },
  pinErrorText: { fontSize: 12, color: Colors.red },
  unlockBtns: { flexDirection: 'row', gap: Spacing.sm, width: '100%', marginTop: Spacing.sm },
  unlockBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  unlockBtnCancel: { backgroundColor: Colors.surface2 },
  unlockBtnConfirm: { backgroundColor: Colors.primary },
  unlockBtnCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  unlockBtnConfirmText: { fontSize: 14, fontWeight: '700', color: Colors.black },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  addSheet: {
    backgroundColor: Colors.surface1,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: 12,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  modalHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  addTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },
  addInput: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  addInputMulti: { minHeight: 100, textAlignVertical: 'top' },
  catScroll: { gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primaryBorder },
  catLabel: { fontSize: 12, color: Colors.textTertiary },
  catLabelActive: { color: Colors.primary, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: 4,
  },
  addBtnDisabled: { backgroundColor: Colors.surface3 },
  addBtnText: { fontSize: 14, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
});
