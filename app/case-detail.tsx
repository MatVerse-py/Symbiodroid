import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { GlassCard } from '@/components';
import { useForense } from '@/hooks/useForense';
import { OmegaStatus, FlagSeverity } from '@/services/forenseService';
import { useAlert } from '@/template';

type Tab = 'overview' | 'timeline' | 'flags' | 'evidence' | 'dossie';

const OMEGA_COLORS: Record<OmegaStatus, string> = {
  PASS: Colors.primary,
  BLOCK: Colors.red,
  PENDING: Colors.textTertiary,
  REVIEW: Colors.orange,
};

const SEVERITY_COLORS: Record<FlagSeverity, string> = {
  critical: Colors.red,
  high: Colors.orange,
  medium: Colors.gold,
  low: Colors.cyan,
};

const EVIDENCE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  whatsapp: 'chatbubbles',
  print: 'image',
  audio: 'mic',
  doc: 'document-text',
  financial: 'card',
  zip: 'archive',
  other: 'folder',
};

function formatTs(ts: number, full = false): string {
  if (full) {
    return new Date(ts).toLocaleString('pt-BR');
  }
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function CaseDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const { showAlert } = useAlert();
  const {
    cases,
    evidenceMap,
    timelineMap,
    flagMap,
    processingCaseId,
    processStep,
    processStepIndex,
    startProcessing,
    closeCase,
    reviewEvent,
    getDossie,
  } = useForense();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const forenseCase = cases.find(c => c.id === caseId);
  const evidences = evidenceMap[caseId] || [];
  const events = timelineMap[caseId] || [];
  const flags = flagMap[caseId] || [];
  const dossie = getDossie(caseId);
  const isProcessing = processingCaseId === caseId;

  if (!forenseCase) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        </Pressable>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Caso não encontrado</Text>
        </View>
      </View>
    );
  }

  const criticalFlags = flags.filter(f => f.severity === 'critical');
  const omegaColor = OMEGA_COLORS[forenseCase.omegaStatus];

  const TABS: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; count?: number }> = [
    { id: 'overview', label: 'Visão Geral', icon: 'grid' },
    { id: 'timeline', label: 'Timeline', icon: 'time', count: events.length },
    { id: 'flags', label: 'Flags', icon: 'flag', count: flags.length },
    { id: 'evidence', label: 'Evidências', icon: 'documents', count: evidences.length },
    { id: 'dossie', label: 'Dossiê', icon: 'document-text' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn2, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.caseId}>{forenseCase.id}</Text>
          <Text style={styles.caseTitle} numberOfLines={1}>{forenseCase.title}</Text>
        </View>
        <View style={[styles.omegaPill, { backgroundColor: `${omegaColor}15`, borderColor: `${omegaColor}30` }]}>
          <View style={[styles.omegaDot, { backgroundColor: omegaColor }]} />
          <Text style={[styles.omegaText, { color: omegaColor }]}>Ω {forenseCase.omegaStatus}</Text>
        </View>
      </View>

      {/* Processing Banner */}
      {isProcessing ? (
        <View style={styles.processingBanner}>
          <Ionicons name="flash" size={14} color={Colors.gold} />
          <Text style={styles.processingText}>{processStep}</Text>
          <View style={styles.processingBarBg}>
            <View style={[styles.processingBarFill, { width: `${((processStepIndex + 1) / 7) * 100}%` as any }]} />
          </View>
        </View>
      ) : null}

      {/* Omega Gate Alert */}
      {forenseCase.omegaStatus === 'BLOCK' && !isProcessing ? (
        <View style={styles.omegaAlert}>
          <Ionicons name="shield" size={16} color={Colors.red} />
          <Text style={styles.omegaAlertText}>
            Ω-GATE BLOQUEADO — {criticalFlags.length} flag(s) crítica(s). Conclusão requer revisão humana.
          </Text>
        </View>
      ) : null}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map(tab => (
            <Pressable
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={activeTab === tab.id ? Colors.primary : Colors.textTertiary}
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 ? (
                <View style={[styles.tabBadge, { backgroundColor: activeTab === tab.id ? Colors.primaryGlow : Colors.surface3 }]}>
                  <Text style={[styles.tabBadgeText, { color: activeTab === tab.id ? Colors.primary : Colors.textTertiary }]}>
                    {tab.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' ? (
          <View style={styles.section}>
            <GlassCard accent={forenseCase.omegaStatus === 'BLOCK' ? 'none' : 'green'} style={styles.overviewCard}>
              <Text style={styles.sectionLabel}>STATUS</Text>
              <View style={styles.overviewMetrics}>
                <View style={styles.oMetric}>
                  <Text style={[styles.oMetricNum, { color: Colors.primary }]}>{evidences.length}</Text>
                  <Text style={styles.oMetricLabel}>Arquivos</Text>
                </View>
                <View style={styles.oMetric}>
                  <Text style={[styles.oMetricNum, { color: Colors.cyan }]}>{events.length}</Text>
                  <Text style={styles.oMetricLabel}>Mensagens</Text>
                </View>
                <View style={styles.oMetric}>
                  <Text style={[styles.oMetricNum, { color: Colors.red }]}>{flags.length}</Text>
                  <Text style={styles.oMetricLabel}>Flags</Text>
                </View>
                <View style={styles.oMetric}>
                  <Text style={[styles.oMetricNum, { color: omegaColor }]}>{criticalFlags.length}</Text>
                  <Text style={styles.oMetricLabel}>Críticas</Text>
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.sealCard}>
              <Text style={styles.sectionLabel}>SOVEREIGN SEAL</Text>
              <Text style={styles.sealHash}>{forenseCase.sovereignSeal}</Text>
              <Text style={styles.sealNote}>Hash de integridade soberana · SYMBIOS v1.0</Text>
            </GlassCard>

            {forenseCase.description ? (
              <GlassCard style={styles.descCard}>
                <Text style={styles.sectionLabel}>DESCRIÇÃO</Text>
                <Text style={styles.descText}>{forenseCase.description}</Text>
              </GlassCard>
            ) : null}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              {(forenseCase.status === 'draft') ? (
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, styles.actionBtnPrimary, pressed && { opacity: 0.8 }]}
                  onPress={() => startProcessing(forenseCase.id)}
                  disabled={isProcessing}
                >
                  <Ionicons name="flash" size={16} color={Colors.black} />
                  <Text style={styles.actionBtnText}>PROCESSAR CASO</Text>
                </Pressable>
              ) : null}
              {forenseCase.status === 'analyzed' ? (
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, styles.actionBtnGold, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    closeCase(forenseCase.id);
                    showAlert('Caso encerrado', 'O caso foi marcado como encerrado.');
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color={Colors.black} />
                  <Text style={styles.actionBtnText}>ENCERRAR CASO</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── TIMELINE ── */}
        {activeTab === 'timeline' ? (
          <View style={styles.section}>
            {events.length === 0 ? (
              <View style={styles.emptyTab}>
                <Ionicons name="time-outline" size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyTabText}>Timeline não processada</Text>
                <Text style={styles.emptyTabSub}>Processe o caso para gerar a timeline</Text>
              </View>
            ) : (
              events.map((event, i) => (
                <View key={event.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineDot,
                      {
                        backgroundColor: event.omegaStatus === 'BLOCK' ? Colors.red
                          : event.flags.length > 0 ? Colors.gold
                          : Colors.surface3,
                        borderColor: event.omegaStatus === 'BLOCK' ? Colors.red
                          : event.flags.length > 0 ? Colors.gold
                          : Colors.border,
                      }
                    ]} />
                    {i < events.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={styles.timelineRight}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineAuthor}>{event.author}</Text>
                      <Text style={styles.timelineDate}>{formatTs(event.timestamp)}</Text>
                    </View>
                    <Text style={styles.timelineContent}>{event.content}</Text>

                    {event.flags.length > 0 ? (
                      <View style={styles.timelineFlags}>
                        {event.flags.map(f => (
                          <View key={f} style={styles.timelineFlagChip}>
                            <Ionicons name="flag" size={10} color={Colors.red} />
                            <Text style={styles.timelineFlagText}>{f}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.timelineFooter}>
                      <Text style={styles.timelineHash}>{event.sourceHash.slice(0, 12)}...</Text>
                      <View style={styles.timelineReview}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.reviewBtn,
                            event.reviewStatus === 'confirmed' && styles.reviewBtnConfirmed,
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={() => reviewEvent(forenseCase.id, event.id, 'confirmed')}
                        >
                          <Ionicons name="checkmark" size={10} color={event.reviewStatus === 'confirmed' ? Colors.black : Colors.primary} />
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.reviewBtn,
                            event.reviewStatus === 'rejected' && styles.reviewBtnRejected,
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={() => reviewEvent(forenseCase.id, event.id, 'rejected')}
                        >
                          <Ionicons name="close" size={10} color={event.reviewStatus === 'rejected' ? Colors.black : Colors.red} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* ── FLAGS ── */}
        {activeTab === 'flags' ? (
          <View style={styles.section}>
            {flags.length === 0 ? (
              <View style={styles.emptyTab}>
                <Ionicons name="flag-outline" size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyTabText}>Nenhuma flag detectada</Text>
                <Text style={styles.emptyTabSub}>Processe o caso para analisar inconsistências</Text>
              </View>
            ) : (
              <>
                {criticalFlags.length > 0 ? (
                  <View style={styles.omegaBlockCard}>
                    <Ionicons name="shield" size={20} color={Colors.red} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.omegaBlockTitle}>Ω-GATE: BLOQUEADO</Text>
                      <Text style={styles.omegaBlockDesc}>
                        {criticalFlags.length} flag(s) crítica(s) impedem a emissão de conclusão sem revisão humana.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {flags.map(flag => (
                  <GlassCard
                    key={flag.id}
                    accent={flag.severity === 'critical' ? 'none' : flag.severity === 'high' ? 'gold' : 'cyan'}
                    style={styles.flagCard}
                  >
                    <View style={styles.flagHeader}>
                      <View style={[styles.flagSeverityBadge, { backgroundColor: `${SEVERITY_COLORS[flag.severity]}15` }]}>
                        <Text style={[styles.flagSeverityText, { color: SEVERITY_COLORS[flag.severity] }]}>
                          {flag.severity.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.flagCode}>{flag.code}</Text>
                      {flag.omegaBlock ? (
                        <View style={styles.flagOmegaBlock}>
                          <Ionicons name="shield" size={10} color={Colors.red} />
                          <Text style={styles.flagOmegaBlockText}>BLOQUEIA</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.flagLabel}>{flag.label}</Text>
                    <Text style={styles.flagDesc}>{flag.description}</Text>
                    <Text style={styles.flagDate}>
                      Detectado: {formatTs(flag.detectedAt, true)}
                    </Text>
                  </GlassCard>
                ))}
              </>
            )}
          </View>
        ) : null}

        {/* ── EVIDENCE ── */}
        {activeTab === 'evidence' ? (
          <View style={styles.section}>
            {evidences.map(ev => (
              <GlassCard key={ev.id} style={styles.evidenceCard}>
                <View style={styles.evidenceHeader}>
                  <View style={[styles.evidenceIcon, { backgroundColor: Colors.surface2 }]}>
                    <Ionicons
                      name={EVIDENCE_ICONS[ev.type] || 'folder'}
                      size={20}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.evidenceFilename} numberOfLines={1}>{ev.filename}</Text>
                    <Text style={styles.evidenceType}>{ev.type.toUpperCase()} · {ev.sizeLabel}</Text>
                  </View>
                  <View style={[
                    styles.evidenceStatusBadge,
                    { backgroundColor: ev.status === 'extracted' ? Colors.primaryGlow : Colors.surface3 }
                  ]}>
                    <Text style={[
                      styles.evidenceStatusText,
                      { color: ev.status === 'extracted' ? Colors.primary : Colors.textTertiary }
                    ]}>
                      {ev.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.hashRow}>
                  <Ionicons name="shield-checkmark" size={12} color={Colors.textTertiary} />
                  <Text style={styles.hashText} numberOfLines={1}>SHA-256: {ev.sha256}</Text>
                </View>
              </GlassCard>
            ))}
          </View>
        ) : null}

        {/* ── DOSSIE ── */}
        {activeTab === 'dossie' ? (
          <View style={styles.section}>
            {!dossie ? (
              <View style={styles.emptyTab}>
                <Ionicons name="document-text-outline" size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyTabText}>Dossiê não gerado</Text>
                <Text style={styles.emptyTabSub}>Processe o caso para gerar o dossiê pericial</Text>
              </View>
            ) : (
              <>
                {forenseCase.omegaStatus === 'BLOCK' ? (
                  <View style={styles.dossieBlockAlert}>
                    <Ionicons name="warning" size={16} color={Colors.red} />
                    <Text style={styles.dossieBlockText}>
                      Dossiê gerado com restrições. Ω-Gate bloqueou flags críticas — revisão humana obrigatória.
                    </Text>
                  </View>
                ) : null}
                <GlassCard
                  accent={forenseCase.omegaStatus === 'PASS' ? 'green' : 'gold'}
                  style={styles.dossieCard}
                >
                  <Text style={styles.dossieContent}>{dossie}</Text>
                </GlassCard>
                <Pressable
                  style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => showAlert('Em breve', 'Exportação de dossiê disponível na próxima versão.')}
                >
                  <Ionicons name="download-outline" size={16} color={Colors.black} />
                  <Text style={styles.copyBtnText}>EXPORTAR DOSSIÊ</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface0 },
  backBtn: { padding: Spacing.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn2: { padding: 4 },
  headerCenter: { flex: 1, gap: 2 },
  caseId: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary, fontFamily: 'monospace', letterSpacing: 1 },
  caseTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  omegaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  omegaDot: { width: 5, height: 5, borderRadius: 3 },
  omegaText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.goldGlow,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGold,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  processingText: { fontSize: 11, color: Colors.gold, flex: 1 },
  processingBarBg: { width: 60, height: 3, backgroundColor: Colors.surface3, borderRadius: 2, overflow: 'hidden' },
  processingBarFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 2 },

  omegaAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,68,68,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  omegaAlertText: { flex: 1, fontSize: 12, color: Colors.red, lineHeight: 17 },

  tabBar: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabScroll: { gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primaryBorder },
  tabText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  tabBadge: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { fontSize: 9, fontWeight: '700' },

  content: { padding: Spacing.md },
  section: { gap: 12 },

  sectionLabel: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 2, marginBottom: 4 },

  overviewCard: { gap: 12 },
  overviewMetrics: { flexDirection: 'row', justifyContent: 'space-around' },
  oMetric: { alignItems: 'center', gap: 4 },
  oMetricNum: { fontSize: 28, fontWeight: '700' },
  oMetricLabel: { fontSize: 10, color: Colors.textTertiary, letterSpacing: 0.5 },

  sealCard: { gap: 6 },
  sealHash: { fontSize: 12, color: Colors.primary, fontFamily: 'monospace', lineHeight: 18 },
  sealNote: { fontSize: 10, color: Colors.textTertiary },

  descCard: { gap: 6 },
  descText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  actionRow: { gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: 14,
  },
  actionBtnPrimary: { backgroundColor: Colors.red },
  actionBtnGold: { backgroundColor: Colors.gold },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: Colors.black, letterSpacing: 1 },

  emptyTab: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  emptyTabSub: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center' },

  // Timeline
  timelineItem: { flexDirection: 'row', gap: 12, minHeight: 80 },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 4 },
  timelineLine: { flex: 1, width: 1, backgroundColor: Colors.border, marginTop: 4 },
  timelineRight: { flex: 1, paddingBottom: 16, gap: 5 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineAuthor: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  timelineDate: { fontSize: 10, color: Colors.textTertiary },
  timelineContent: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  timelineFlags: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  timelineFlagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timelineFlagText: { fontSize: 9, fontWeight: '700', color: Colors.red },
  timelineFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  timelineHash: { fontSize: 9, color: Colors.textTertiary, fontFamily: 'monospace' },
  timelineReview: { flexDirection: 'row', gap: 4 },
  reviewBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnConfirmed: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  reviewBtnRejected: { backgroundColor: Colors.red, borderColor: Colors.red },

  // Flags
  omegaBlockCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
    padding: Spacing.md,
  },
  omegaBlockTitle: { fontSize: 12, fontWeight: '800', color: Colors.red, letterSpacing: 1 },
  omegaBlockDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginTop: 3 },
  flagCard: { gap: 8 },
  flagHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flagSeverityBadge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  flagSeverityText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  flagCode: { fontSize: 10, color: Colors.textTertiary, fontFamily: 'monospace', flex: 1 },
  flagOmegaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  flagOmegaBlockText: { fontSize: 8, fontWeight: '800', color: Colors.red, letterSpacing: 1 },
  flagLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  flagDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  flagDate: { fontSize: 10, color: Colors.textTertiary },

  // Evidence
  evidenceCard: { gap: 8 },
  evidenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  evidenceIcon: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  evidenceFilename: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  evidenceType: { fontSize: 10, color: Colors.textTertiary, letterSpacing: 0.5 },
  evidenceStatusBadge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  evidenceStatusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  hashRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hashText: { flex: 1, fontSize: 10, color: Colors.textTertiary, fontFamily: 'monospace' },

  // Dossie
  dossieBlockAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
    padding: Spacing.md,
  },
  dossieBlockText: { flex: 1, fontSize: 12, color: Colors.red, lineHeight: 17 },
  dossieCard: {},
  dossieContent: { fontSize: 11, color: Colors.textSecondary, fontFamily: 'monospace', lineHeight: 18 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: 4,
  },
  copyBtnText: { fontSize: 14, fontWeight: '800', color: Colors.black, letterSpacing: 1 },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: Colors.textTertiary },
});
