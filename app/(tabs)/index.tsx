import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { GlassCard, MetricCard, OmegaGateIndicator } from '@/components';
import { useAgent } from '@/hooks/useAgent';
import { getSystemMetrics } from '@/services/agentService';
import { QuickActions } from '@/constants/config';
import { useVault } from '@/hooks/useVault';

const { width } = Dimensions.get('window');

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { runs, isRunning, currentStep, currentStepIndex, totalSteps, ledger } = useAgent();
  const { entries } = useVault();
  const metrics = getSystemMetrics();
  const [currentTime, setCurrentTime] = useState(new Date());

  const sovereigntyScore = Math.min(100, Math.round(
    40 +
    Math.min(30, ledger.filter(l => l.status === 'PASS').length * 3) +
    Math.min(20, entries.length * 4) +
    (ledger.filter(l => l.status === 'BLOCK').length > 0 ? 10 : 0)
  ));
  const sovereigntyLevel = sovereigntyScore >= 90 ? 'SOBERANO' : sovereigntyScore >= 70 ? 'PROTEGIDO' : sovereigntyScore >= 50 ? 'PARCIAL' : 'EXPOSTO';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const recentRuns = runs.slice(0, 3);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.systemName}>SYMBIODROID</Text>
            <Text style={styles.systemSub}>Sistema Operacional Soberano · v1.0</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.onlineIndicator}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>ONLINE</Text>
            </View>
            <Text style={styles.time}>
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <Image
            source={require('@/assets/images/hero-symbiodroid.png')}
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>OMEGA AGENT</Text>
              <Text style={styles.heroSub}>Ω-Gate Ativo · Modo Soberano</Text>
              <Pressable
                style={({ pressed }) => [styles.heroBtn, pressed && { opacity: 0.8 }]}
                onPress={() => router.push('/(tabs)/agent')}
              >
                <Ionicons name="radio" size={14} color={Colors.black} />
                <Text style={styles.heroBtnText}>ATIVAR AGENTE</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Omega Gate Status */}
        <OmegaGateIndicator
          isActive={isRunning}
          currentStep={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
        />

        {/* Metrics */}
        <Text style={styles.sectionTitle}>MÉTRICAS DO SISTEMA</Text>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Execuções"
            value={metrics.agentRuns}
            icon="flash"
            color={Colors.primary}
            trend={`+${metrics.agentRuns}`}
          />
          <MetricCard
            label="Sucesso"
            value={`${metrics.successRate}%`}
            icon="checkmark-circle"
            color={Colors.primary}
          />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Memória"
            value={metrics.memoryEntries}
            icon="library"
            color={Colors.cyan}
          />
          <MetricCard
            label="Bloqueados"
            value={metrics.blockedRequests}
            icon="shield"
            color={Colors.red}
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>AÇÕES RÁPIDAS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsScroll}
        >
          {QuickActions.map(action => (
            <Pressable
              key={action.id}
              style={({ pressed }) => [styles.actionChip, pressed && styles.actionChipPressed]}
              onPress={() => router.push('/(tabs)/agent')}
            >
              <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={16} color={Colors.primary} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Recent Runs */}
        <Text style={styles.sectionTitle}>EXECUÇÕES RECENTES</Text>
        {recentRuns.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="radio-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Nenhuma execução ainda</Text>
            <Text style={styles.emptySubText}>Abra o Agente e envie um comando</Text>
          </GlassCard>
        ) : (
          recentRuns.map(run => (
            <GlassCard
              key={run.id}
              accent={run.status === 'DONE' ? 'green' : run.status === 'BLOCK' ? 'none' : 'gold'}
              style={styles.runCard}
            >
              <View style={styles.runHeader}>
                <View style={[
                  styles.runStatusDot,
                  { backgroundColor: run.status === 'DONE' ? Colors.primary : run.status === 'BLOCK' ? Colors.red : Colors.gold }
                ]} />
                <Text style={styles.runStatus}>{run.status}</Text>
                <Text style={styles.runTime}>{formatRelativeTime(run.timestamp)}</Text>
              </View>
              <Text style={styles.runPrompt} numberOfLines={2}>{run.prompt}</Text>
              {run.duration ? (
                <Text style={styles.runDuration}>{(run.duration / 1000).toFixed(1)}s · {run.plan.length} etapas</Text>
              ) : null}
            </GlassCard>
          ))
        )}

        {/* Sovereignty Score */}
        <Text style={styles.sectionTitle}>SOBERANIA DIGITAL</Text>
        <GlassCard accent="green" style={styles.sovereignCard}>
          <View style={styles.sovereignHeader}>
            <View>
              <Text style={styles.sovereignScore}>{sovereigntyScore}<Text style={styles.sovereignPct}>%</Text></Text>
              <Text style={styles.sovereignLevel}>{sovereigntyLevel}</Text>
            </View>
            <View style={styles.sovereignRight}>
              <View style={styles.sovereignBarBg}>
                <View style={[styles.sovereignBarFill, { width: `${sovereigntyScore}%` as any }]} />
              </View>
              <Text style={styles.sovereignDesc}>Controle sobre sua identidade digital</Text>
            </View>
          </View>
          <View style={styles.sovereignPillars}>
            {[
              { label: 'Vault', ok: entries.length > 0 },
              { label: 'Ω-Gate', ok: true },
              { label: 'Ledger', ok: ledger.length > 0 },
              { label: 'Legado', ok: false },
            ].map(p => (
              <View key={p.label} style={styles.pillar}>
                <View style={[styles.pillarDot, { backgroundColor: p.ok ? Colors.primary : Colors.surface3 }]} />
                <Text style={[styles.pillarLabel, { color: p.ok ? Colors.primary : Colors.textTertiary }]}>{p.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* System Info */}
        <GlassCard accent="green" style={styles.systemCard}>
          <View style={styles.systemRow}>
            <Ionicons name="server" size={16} color={Colors.primary} />
            <Text style={styles.systemLabel}>UPTIME</Text>
            <Text style={styles.systemValue}>{metrics.uptime}</Text>
          </View>
          <View style={styles.systemRow}>
            <Ionicons name="sync" size={16} color={Colors.cyan} />
            <Text style={styles.systemLabel}>ÚLTIMO SYNC</Text>
            <Text style={styles.systemValue}>{formatRelativeTime(metrics.lastSync)}</Text>
          </View>
          <View style={styles.systemRow}>
            <Ionicons name="apps" size={16} color={Colors.purple} />
            <Text style={styles.systemLabel}>SKILLS ATIVAS</Text>
            <Text style={styles.systemValue}>{metrics.activeSkills}/6</Text>
          </View>
        </GlassCard>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface0 },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  systemName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 3,
  },
  systemSub: {
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  onlineIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  onlineText: { fontSize: 9, color: Colors.primary, fontWeight: '700', letterSpacing: 1 },
  time: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'monospace' },

  heroBanner: {
    height: 180,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  heroImage: { position: 'absolute', width: '100%', height: '100%' },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    padding: Spacing.md,
  },
  heroContent: { gap: 6 },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 3,
  },
  heroSub: { fontSize: 11, color: Colors.primary, letterSpacing: 1 },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  heroBtnText: { fontSize: 12, fontWeight: '800', color: Colors.black, letterSpacing: 1 },

  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 2,
    marginBottom: -4,
  },
  metricsRow: { flexDirection: 'row', gap: Spacing.sm },

  actionsScroll: { gap: Spacing.sm, paddingRight: Spacing.md },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionChipPressed: { opacity: 0.7 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: Spacing.xl },
  emptyText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: 12, color: Colors.textTertiary },

  runCard: { gap: 6 },
  runHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  runStatusDot: { width: 6, height: 6, borderRadius: 3 },
  runStatus: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 1 },
  runTime: { fontSize: 10, color: Colors.textTertiary, marginLeft: 'auto' },
  runPrompt: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  runDuration: { fontSize: 10, color: Colors.textTertiary, fontFamily: 'monospace' },

  sovereignCard: { gap: 12 },
  sovereignHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sovereignScore: { fontSize: 48, fontWeight: '800', color: Colors.primary, lineHeight: 52 },
  sovereignPct: { fontSize: 24, fontWeight: '600', color: Colors.primaryDim },
  sovereignLevel: { fontSize: 10, color: Colors.primary, fontWeight: '700', letterSpacing: 2 },
  sovereignRight: { flex: 1, gap: 8 },
  sovereignBarBg: { height: 6, backgroundColor: Colors.surface3, borderRadius: 3, overflow: 'hidden' },
  sovereignBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  sovereignDesc: { fontSize: 11, color: Colors.textTertiary, lineHeight: 16 },
  sovereignPillars: { flexDirection: 'row', gap: Spacing.md },
  pillar: { alignItems: 'center', gap: 4 },
  pillarDot: { width: 8, height: 8, borderRadius: 4 },
  pillarLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  systemCard: { gap: 12 },
  systemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  systemLabel: { fontSize: 10, color: Colors.textTertiary, letterSpacing: 1, flex: 1 },
  systemValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, fontFamily: 'monospace' },
});
