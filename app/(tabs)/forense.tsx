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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { GlassCard } from '@/components';
import { useForense } from '@/hooks/useForense';
import { getForenseSummary, CaseStatus, OmegaStatus } from '@/services/forenseService';
import { useAlert } from '@/template';

const STATUS_LABELS: Record<CaseStatus, string> = {
  draft: 'RASCUNHO',
  processing: 'PROCESSANDO',
  analyzed: 'ANALISADO',
  review: 'EM REVISÃO',
  closed: 'ENCERRADO',
};

const STATUS_COLORS: Record<CaseStatus, string> = {
  draft: Colors.textTertiary,
  processing: Colors.gold,
  analyzed: Colors.cyan,
  review: Colors.orange,
  closed: Colors.primary,
};

const OMEGA_COLORS: Record<OmegaStatus, string> = {
  PASS: Colors.primary,
  BLOCK: Colors.red,
  PENDING: Colors.textTertiary,
  REVIEW: Colors.orange,
};

const MOCK_FILENAMES = [
  'WhatsApp_Chat.txt',
  'prints_conversa.zip',
  'audio_01.m4a',
  'extrato_bancario.xlsx',
  'contrato_assinado.pdf',
  'print_evidencia.png',
];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ForenseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const {
    cases,
    evidenceMap,
    addCase,
    addEvidence,
    startProcessing,
    deleteCase,
    processingCaseId,
    processStep,
    processStepIndex,
  } = useForense();

  const [createVisible, setCreateVisible] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [caseDesc, setCaseDesc] = useState('');
  const [filterStatus, setFilterStatus] = useState<CaseStatus | 'all'>('all');

  const summary = getForenseSummary(cases);

  const filtered = filterStatus === 'all'
    ? cases
    : cases.filter(c => c.status === filterStatus);

  const handleCreate = () => {
    if (!caseTitle.trim()) return;
    const newCase = addCase(caseTitle.trim(), caseDesc.trim() || 'Caso de análise forense.');

    // Add mock evidences
    MOCK_FILENAMES.slice(0, 3).forEach(fn => addEvidence(newCase.id, fn));

    setCaseTitle('');
    setCaseDesc('');
    setCreateVisible(false);

    showAlert(
      'Caso criado',
      `${newCase.id}\n\n3 evidências adicionadas. Abra o caso para processar.`,
    );
  };

  const handleDelete = (caseId: string, title: string) => {
    showAlert(`Excluir caso?`, `"${title}" será removido permanentemente.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteCase(caseId) },
    ]);
  };

  const FILTER_OPTIONS: Array<{ value: CaseStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'draft', label: 'Rascunho' },
    { value: 'processing', label: 'Processando' },
    { value: 'analyzed', label: 'Analisados' },
    { value: 'review', label: 'Revisão' },
    { value: 'closed', label: 'Encerrados' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>FORENSE</Text>
          <Text style={styles.subtitle}>SYMBIOS Evidence OS · Ω-Gate Ativo</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.newCaseBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setCreateVisible(true)}
        >
          <Ionicons name="add" size={16} color={Colors.black} />
          <Text style={styles.newCaseBtnText}>NOVO CASO</Text>
        </Pressable>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{summary.total}</Text>
          <Text style={styles.statLabel}>casos</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statCell}>
          <Text style={[styles.statNum, { color: Colors.cyan }]}>{summary.active}</Text>
          <Text style={styles.statLabel}>ativos</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statCell}>
          <Text style={[styles.statNum, { color: Colors.red }]}>{summary.blocked}</Text>
          <Text style={styles.statLabel}>bloqueados</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statCell}>
          <Text style={[styles.statNum, { color: Colors.gold }]}>{summary.totalFlags}</Text>
          <Text style={styles.statLabel}>flags</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTER_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={[styles.filterChip, filterStatus === opt.value && styles.filterChipActive]}
              onPress={() => setFilterStatus(opt.value)}
            >
              <Text style={[styles.filterText, filterStatus === opt.value && styles.filterTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Cases List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Nenhum caso encontrado</Text>
            <Text style={styles.emptySubText}>Crie um novo caso para iniciar a análise</Text>
            <Pressable
              style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setCreateVisible(true)}
            >
              <Ionicons name="add-circle" size={16} color={Colors.black} />
              <Text style={styles.emptyBtnText}>Criar Primeiro Caso</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map(c => {
            const evidences = evidenceMap[c.id] || [];
            const isProcessing = processingCaseId === c.id;

            return (
              <Pressable
                key={c.id}
                style={({ pressed }) => [styles.caseCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push({
                  pathname: '/case-detail',
                  params: { caseId: c.id },
                })}
                onLongPress={() => handleDelete(c.id, c.title)}
              >
                <GlassCard
                  accent={c.omegaStatus === 'BLOCK' ? 'none' : c.omegaStatus === 'PASS' ? 'green' : 'gold'}
                  style={styles.caseInner}
                >
                  {/* Case Header Row */}
                  <View style={styles.caseHeaderRow}>
                    <View style={styles.caseIdBadge}>
                      <Text style={styles.caseId}>{c.id}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[c.status]}18` }]}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[c.status] }]} />
                      <Text style={[styles.statusText, { color: STATUS_COLORS[c.status] }]}>
                        {STATUS_LABELS[c.status]}
                      </Text>
                    </View>
                  </View>

                  {/* Title */}
                  <Text style={styles.caseTitle} numberOfLines={2}>{c.title}</Text>
                  {c.description ? (
                    <Text style={styles.caseDesc} numberOfLines={2}>{c.description}</Text>
                  ) : null}

                  {/* Processing bar */}
                  {isProcessing ? (
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${((processStepIndex + 1) / 7) * 100}%` as any }]} />
                    </View>
                  ) : null}
                  {isProcessing ? (
                    <Text style={styles.processStep}>{processStep}</Text>
                  ) : null}

                  {/* Metrics Row */}
                  <View style={styles.caseMetrics}>
                    <View style={styles.caseMetric}>
                      <Ionicons name="documents" size={12} color={Colors.textTertiary} />
                      <Text style={styles.caseMetricText}>{c.totalFiles} arqs</Text>
                    </View>
                    <View style={styles.caseMetric}>
                      <Ionicons name="chatbubbles" size={12} color={Colors.textTertiary} />
                      <Text style={styles.caseMetricText}>{c.totalMessages} msgs</Text>
                    </View>
                    {c.totalFlags > 0 ? (
                      <View style={styles.caseMetric}>
                        <Ionicons name="flag" size={12} color={Colors.red} />
                        <Text style={[styles.caseMetricText, { color: Colors.red }]}>{c.totalFlags} flags</Text>
                      </View>
                    ) : null}
                    <View style={styles.caseMetricSpacer} />
                    <View style={[styles.omegaBadge, { backgroundColor: `${OMEGA_COLORS[c.omegaStatus]}15` }]}>
                      <Text style={[styles.omegaText, { color: OMEGA_COLORS[c.omegaStatus] }]}>
                        Ω {c.omegaStatus}
                      </Text>
                    </View>
                  </View>

                  {/* Footer */}
                  <View style={styles.caseFooter}>
                    <Text style={styles.caseDate}>{formatDate(c.createdAt)}</Text>
                    {c.status === 'draft' && evidences.length > 0 && !isProcessing ? (
                      <Pressable
                        style={({ pressed }) => [styles.processBtn, pressed && { opacity: 0.8 }]}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          startProcessing(c.id);
                        }}
                      >
                        <Ionicons name="flash" size={12} color={Colors.black} />
                        <Text style={styles.processBtnText}>PROCESSAR</Text>
                      </Pressable>
                    ) : c.status !== 'draft' ? (
                      <View style={styles.viewDetail}>
                        <Text style={styles.viewDetailText}>Ver detalhes</Text>
                        <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
                      </View>
                    ) : null}
                  </View>
                </GlassCard>
              </Pressable>
            );
          })
        )}

        {/* How-it-works */}
        {cases.length === 0 ? (
          <GlassCard accent="gold" style={styles.howCard}>
            <Text style={styles.howTitle}>COMO FUNCIONA</Text>
            {[
              { icon: 'folder-open', step: '01', text: 'Crie um caso com título e descrição' },
              { icon: 'cloud-upload', step: '02', text: 'Anexe evidências: WhatsApp, prints, áudios, extratos' },
              { icon: 'flash', step: '03', text: 'Processe: SHA-256, OCR, STT, parser, flags' },
              { icon: 'shield', step: '04', text: 'Ω-Gate avalia inconsistências e bloqueia se necessário' },
              { icon: 'document-text', step: '05', text: 'Dossiê pericial soberano gerado com cadeia de custódia' },
            ].map(item => (
              <View key={item.step} style={styles.howRow}>
                <View style={styles.howStepBadge}>
                  <Text style={styles.howStepText}>{item.step}</Text>
                </View>
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={Colors.gold} />
                <Text style={styles.howText}>{item.text}</Text>
              </View>
            ))}
          </GlassCard>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Create Case Modal */}
      <Modal
        visible={createVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateVisible(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={() => setCreateVisible(false)}>
            <View style={[styles.createSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHandle} />

              <View style={styles.createHeader}>
                <Ionicons name="folder-open" size={24} color={Colors.red} />
                <Text style={styles.createTitle}>NOVO CASO FORENSE</Text>
              </View>

              <Text style={styles.createLabel}>Título do Caso *</Text>
              <TextInput
                style={styles.createInput}
                value={caseTitle}
                onChangeText={setCaseTitle}
                placeholder="Ex: Análise conversa WhatsApp — contrato"
                placeholderTextColor={Colors.textTertiary}
                maxLength={80}
              />

              <Text style={styles.createLabel}>Descrição</Text>
              <TextInput
                style={[styles.createInput, styles.createInputMulti]}
                value={caseDesc}
                onChangeText={setCaseDesc}
                placeholder="Descreva o contexto do caso..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={300}
              />

              <View style={styles.createWarning}>
                <Ionicons name="information-circle" size={14} color={Colors.cyan} />
                <Text style={styles.createWarningText}>
                  3 evidências de exemplo serão adicionadas automaticamente para demonstração.
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.createBtn,
                  !caseTitle.trim() && styles.createBtnDisabled,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleCreate}
                disabled={!caseTitle.trim()}
              >
                <Ionicons name="shield-checkmark" size={16} color={Colors.black} />
                <Text style={styles.createBtnText}>CRIAR CASO</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 3 },
  subtitle: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  newCaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.red,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newCaseBtnText: { fontSize: 11, fontWeight: '800', color: Colors.black, letterSpacing: 1 },

  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 9, color: Colors.textTertiary, letterSpacing: 0.5 },
  statDiv: { width: 1, backgroundColor: Colors.border },

  filterWrap: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterScroll: { gap: 8, padding: 10, paddingHorizontal: Spacing.md },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface1,
  },
  filterChipActive: { backgroundColor: 'rgba(255,68,68,0.1)', borderColor: 'rgba(255,68,68,0.4)' },
  filterText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  filterTextActive: { color: Colors.red, fontWeight: '700' },

  list: { padding: Spacing.md, gap: 12 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.red,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.black },

  caseCard: {},
  caseInner: { gap: 10 },
  caseHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caseIdBadge: {
    backgroundColor: Colors.surface3,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  caseId: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary, fontFamily: 'monospace', letterSpacing: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  caseTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, lineHeight: 20 },
  caseDesc: { fontSize: 12, color: Colors.textTertiary, lineHeight: 17 },

  progressBar: { height: 3, backgroundColor: Colors.surface3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 2 },
  processStep: { fontSize: 10, color: Colors.gold, fontFamily: 'monospace' },

  caseMetrics: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caseMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  caseMetricText: { fontSize: 11, color: Colors.textTertiary },
  caseMetricSpacer: { flex: 1 },
  omegaBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  omegaText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  caseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caseDate: { fontSize: 10, color: Colors.textTertiary },
  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.red,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  processBtnText: { fontSize: 10, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
  viewDetail: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewDetailText: { fontSize: 11, color: Colors.primary },

  howCard: { gap: 14, marginTop: 8 },
  howTitle: { fontSize: 10, fontWeight: '700', color: Colors.gold, letterSpacing: 2 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  howStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepText: { fontSize: 9, fontWeight: '700', color: Colors.gold },
  howText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  createSheet: {
    backgroundColor: Colors.surface1,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },
  modalHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  createHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  createTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },
  createLabel: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 1 },
  createInput: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  createInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  createWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.cyanDim,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  createWarningText: { flex: 1, fontSize: 11, color: Colors.cyan, lineHeight: 16 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.red,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: 4,
  },
  createBtnDisabled: { backgroundColor: Colors.surface3 },
  createBtnText: { fontSize: 14, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
});
