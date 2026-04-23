import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { GlassCard } from '@/components';
import { useAgent } from '@/hooks/useAgent';
import { AppConfig, LegacyPolicies, ConsentContracts } from '@/constants/config';
import { useAlert } from '@/template';

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  color?: string;
  danger?: boolean;
}

function SettingRow({ icon, label, description, value, toggle, toggleValue, onToggle, onPress, color, danger }: SettingRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingRow, pressed && onPress && { backgroundColor: Colors.surface2 }]}
      onPress={onPress}
      disabled={!onPress && !toggle}
    >
      <View style={[styles.settingIcon, { backgroundColor: `${color || Colors.primary}15` }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.red : (color || Colors.primary)} />
      </View>
      <View style={styles.settingCenter}>
        <Text style={[styles.settingLabel, danger && { color: Colors.red }]}>{label}</Text>
        {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: Colors.surface3, true: Colors.primaryGlow }}
          thumbColor={toggleValue ? Colors.primary : Colors.textTertiary}
        />
      ) : value ? (
        <Text style={styles.settingValue}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { ledger, runs } = useAgent();
  const { showAlert } = useAlert();
  const [omegaGateEnabled, setOmegaGateEnabled] = useState(true);
  const [ledgerEnabled, setLedgerEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [twinFirewall, setTwinFirewall] = useState(true);
  const [consentExpanded, setConsentExpanded] = useState(false);
  const [legacyPolicies, setLegacyPolicies] = useState<Record<string, boolean>>(
    Object.fromEntries(LegacyPolicies.map(p => [p.id, p.defaultValue]))
  );

  const handleClearLedger = () => {
    showAlert('Limpar Ledger?', 'O histórico de execuções será apagado permanentemente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: () => showAlert('Ledger limpo', 'Histórico apagado com sucesso.') },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>CONFIGURAÇÕES</Text>
        <Text style={styles.subtitle}>Sistema · Soberania · Legado</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile Card */}
        <GlassCard accent="green" style={styles.profileCard}>
          <View style={styles.profileLeft}>
            <Image
              source={require('@/assets/images/agent-avatar.png')}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
            <View>
              <Text style={styles.profileName}>Operador Symbios</Text>
              <Text style={styles.profileRole}>ADMIN · NÍVEL SOBERANO</Text>
              <View style={styles.profileBadge}>
                <View style={styles.profileDot} />
                <Text style={styles.profileOnline}>Identidade Protegida</Text>
              </View>
            </View>
          </View>
          <View style={styles.profileStats}>
            <View style={styles.pStat}>
              <Text style={[styles.pStatNum, { color: Colors.primary }]}>{runs.length}</Text>
              <Text style={styles.pStatLabel}>Runs</Text>
            </View>
            <View style={styles.pStat}>
              <Text style={[styles.pStatNum, { color: Colors.gold }]}>{ledger.length}</Text>
              <Text style={styles.pStatLabel}>Ledger</Text>
            </View>
          </View>
        </GlassCard>

        {/* Governance */}
        <Text style={styles.sectionTitle}>GOVERNANÇA</Text>
        <GlassCard style={styles.section}>
          <SettingRow
            icon="shield-checkmark"
            label="Ω-Gate Ativo"
            description="Filtro de segurança para todas as execuções"
            toggle
            toggleValue={omegaGateEnabled}
            onToggle={setOmegaGateEnabled}
            color={Colors.primary}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="book"
            label="Ledger Imutável"
            description="Registro verificável de todas as ações do agente"
            toggle
            toggleValue={ledgerEnabled}
            onToggle={setLedgerEnabled}
            color={Colors.gold}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="wifi-outline"
            label="Modo Offline"
            description="Operar sem conexão (skills limitadas)"
            toggle
            toggleValue={offlineMode}
            onToggle={setOfflineMode}
            color={Colors.orange}
          />
        </GlassCard>

        {/* Sovereign Identity */}
        <Text style={styles.sectionTitle}>IDENTIDADE SOBERANA</Text>
        <GlassCard style={styles.section}>
          <SettingRow
            icon="eye-off"
            label="Twin Firewall"
            description="Detecta clonagem e uso não autorizado da sua identidade digital"
            toggle
            toggleValue={twinFirewall}
            onToggle={setTwinFirewall}
            color={Colors.red}
          />
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.settingRow, pressed && { backgroundColor: Colors.surface2 }]}
            onPress={() => setConsentExpanded(v => !v)}
          >
            <View style={[styles.settingIcon, { backgroundColor: `${Colors.purple}15` }]}>
              <Ionicons name="document-text" size={18} color={Colors.purple} />
            </View>
            <View style={styles.settingCenter}>
              <Text style={styles.settingLabel}>Contratos de Consentimento</Text>
              <Text style={styles.settingDesc}>{ConsentContracts.length} contratos registrados</Text>
            </View>
            <Ionicons name={consentExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} />
          </Pressable>
          {consentExpanded ? ConsentContracts.map((c) => (
            <View key={c.id}>
              <View style={styles.divider} />
              <View style={styles.contractRow}>
                <View style={[styles.contractDot, { backgroundColor: c.status === 'active' ? Colors.primary : Colors.orange }]} />
                <View style={styles.contractInfo}>
                  <Text style={styles.contractEntity}>{c.entity}</Text>
                  <Text style={styles.contractScope}>{c.scope}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.revokeBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => showAlert('Revogar acesso?', `Remover consentimento de "${c.entity}"?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Revogar', style: 'destructive', onPress: () => showAlert('Revogado', 'Acesso revogado e registrado no ledger.') },
                  ])}
                >
                  <Text style={styles.revokeBtnText}>REVOGAR</Text>
                </Pressable>
              </View>
            </View>
          )) : null}
        </GlassCard>

        {/* Legacy Digital */}
        <Text style={styles.sectionTitle}>LEGADO DIGITAL PÓSTUMO</Text>
        <View style={styles.legacyWarning}>
          <Ionicons name="warning" size={14} color={Colors.gold} />
          <Text style={styles.legacyWarningText}>
            Estas políticas governam como sua identidade digital pode ser usada após sua morte. Por padrão, tudo é negado.
          </Text>
        </View>
        <GlassCard accent="gold" style={styles.section}>
          {LegacyPolicies.map((policy, i) => (
            <View key={policy.id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.settingRow}>
                <View style={[styles.settingIcon, {
                  backgroundColor: policy.risk === 'none' ? Colors.primaryGlow
                    : policy.risk === 'low' ? 'rgba(0,229,255,0.1)'
                    : policy.risk === 'medium' ? Colors.goldGlow
                    : 'rgba(255,68,68,0.1)',
                }]}>
                  <Ionicons
                    name={
                      policy.risk === 'none' ? 'shield-checkmark'
                      : policy.risk === 'high' ? 'warning'
                      : 'information-circle'
                    }
                    size={16}
                    color={
                      policy.risk === 'none' ? Colors.primary
                      : policy.risk === 'high' ? Colors.red
                      : policy.risk === 'medium' ? Colors.gold
                      : Colors.cyan
                    }
                  />
                </View>
                <View style={styles.settingCenter}>
                  <Text style={styles.settingLabel}>{policy.label}</Text>
                  <Text style={styles.settingDesc}>{policy.description}</Text>
                </View>
                <Switch
                  value={legacyPolicies[policy.id]}
                  onValueChange={v => setLegacyPolicies(prev => ({ ...prev, [policy.id]: v }))}
                  trackColor={{
                    false: Colors.surface3,
                    true: policy.risk === 'none' ? Colors.primaryGlow
                      : policy.risk === 'high' ? 'rgba(255,68,68,0.3)'
                      : Colors.goldGlow,
                  }}
                  thumbColor={legacyPolicies[policy.id]
                    ? (policy.risk === 'none' ? Colors.primary : policy.risk === 'high' ? Colors.red : Colors.gold)
                    : Colors.textTertiary}
                />
              </View>
            </View>
          ))}
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.settingRow, pressed && { backgroundColor: Colors.surface2 }]}
            onPress={() => showAlert(
              'Assinar Políticas de Legado',
              'Suas preferências serão registradas no ledger e assinadas criptograficamente. Esta ação é auditável.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Confirmar e Assinar', onPress: () => showAlert('Políticas salvas', 'Legado digital registrado no ledger com sucesso.') },
              ]
            )}
          >
            <View style={[styles.settingIcon, { backgroundColor: Colors.goldGlow }]}>
              <Ionicons name="create" size={16} color={Colors.gold} />
            </View>
            <View style={styles.settingCenter}>
              <Text style={[styles.settingLabel, { color: Colors.gold }]}>Assinar Políticas no Ledger</Text>
              <Text style={styles.settingDesc}>Registrar com prova criptográfica</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.gold} />
          </Pressable>
        </GlassCard>

        {/* Agent */}
        <Text style={styles.sectionTitle}>AGENTE</Text>
        <GlassCard style={styles.section}>
          <SettingRow
            icon="radio"
            label="Modelo do Agente"
            value="OMEGA-1"
            color={Colors.primary}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="language"
            label="Idioma"
            value="Português"
            color={Colors.cyan}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="speedometer"
            label="Velocidade"
            value="Máxima"
            color={Colors.gold}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="notifications"
            label="Notificações"
            description="Alertas de execução e erros"
            toggle
            toggleValue={notifications}
            onToggle={setNotifications}
            color={Colors.purple}
          />
        </GlassCard>

        {/* Ledger Stats */}
        <Text style={styles.sectionTitle}>LEDGER</Text>
        <GlassCard accent="gold" style={styles.ledgerCard}>
          <View style={styles.ledgerRow}>
            <Ionicons name="flash" size={14} color={Colors.primary} />
            <Text style={styles.ledgerLabel}>Total de execuções</Text>
            <Text style={styles.ledgerValue}>{runs.length}</Text>
          </View>
          <View style={styles.ledgerRow}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
            <Text style={styles.ledgerLabel}>Aprovadas pelo Ω-Gate</Text>
            <Text style={styles.ledgerValue}>{ledger.filter(l => l.status === 'PASS').length}</Text>
          </View>
          <View style={styles.ledgerRow}>
            <Ionicons name="shield" size={14} color={Colors.red} />
            <Text style={styles.ledgerLabel}>Bloqueadas pelo Ω-Gate</Text>
            <Text style={[styles.ledgerValue, { color: Colors.red }]}>{ledger.filter(l => l.status === 'BLOCK').length}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.clearLedgerBtn, pressed && { opacity: 0.7 }]}
            onPress={handleClearLedger}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.red} />
            <Text style={styles.clearLedgerText}>Limpar Ledger</Text>
          </Pressable>
        </GlassCard>

        {/* System */}
        <Text style={styles.sectionTitle}>SISTEMA</Text>
        <GlassCard style={styles.section}>
          <SettingRow
            icon="information-circle"
            label="Versão"
            value={`${AppConfig.version} (${AppConfig.buildNumber})`}
            color={Colors.textTertiary}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="server"
            label="Ambiente"
            value="SOBERANO · LOCAL"
            color={Colors.cyan}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="document-text-outline"
            label="Exportar Dados"
            onPress={() => showAlert('Em breve', 'Exportação de dados disponível na próxima versão.')}
            color={Colors.gold}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="log-out-outline"
            label="Resetar Sistema"
            onPress={() => showAlert('Resetar?', 'Todos os dados locais serão apagados.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Resetar', style: 'destructive', onPress: () => {} },
            ])}
            danger
          />
        </GlassCard>

        {/* Manifesto */}
        <GlassCard accent="green" style={styles.manifestoCard}>
          <Text style={styles.manifestoTitle}>SYMBIOS MANIFESTO</Text>
          <Text style={styles.manifestoText}>
            "Assim como PQC protege segredos do futuro,{'\n'}Symbios protege a soberania humana{'\n'}do futuro algorítmico."
          </Text>
          <Text style={styles.manifestoTagline}>Own yourself. Now and later.</Text>
        </GlassCard>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>SYMBIODROID · Sistema Operacional Soberano</Text>
          <Text style={styles.footerSub}>Powered by Omega Engine · MatVerse Platform</Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface0 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 3 },
  subtitle: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  scroll: { padding: Spacing.md, gap: Spacing.md },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 2, marginBottom: -4 },

  profileCard: { gap: 12 },
  profileLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  profileName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  profileRole: { fontSize: 9, color: Colors.primary, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  profileDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  profileOnline: { fontSize: 10, color: Colors.primary },
  profileStats: { flexDirection: 'row', gap: Spacing.lg },
  pStat: { alignItems: 'center' },
  pStatNum: { fontSize: 20, fontWeight: '700' },
  pStatLabel: { fontSize: 9, color: Colors.textTertiary, letterSpacing: 0.5 },

  section: { overflow: 'hidden', padding: 0 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 12,
    minHeight: 56,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCenter: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  settingDesc: { fontSize: 11, color: Colors.textTertiary },
  settingValue: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 64 },

  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 10,
  },
  contractDot: { width: 8, height: 8, borderRadius: 4 },
  contractInfo: { flex: 1, gap: 2 },
  contractEntity: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  contractScope: { fontSize: 11, color: Colors.textTertiary },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
    backgroundColor: 'rgba(255,68,68,0.08)',
  },
  revokeBtnText: { fontSize: 9, fontWeight: '700', color: Colors.red, letterSpacing: 1 },

  legacyWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.goldGlow,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  legacyWarningText: { flex: 1, fontSize: 11, color: Colors.gold, lineHeight: 16 },

  ledgerCard: { gap: 10 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  ledgerValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'monospace' },
  clearLedgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,68,68,0.08)',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  clearLedgerText: { fontSize: 12, color: Colors.red, fontWeight: '600' },

  manifestoCard: { alignItems: 'center', gap: 10, paddingVertical: Spacing.lg },
  manifestoTitle: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 3 },
  manifestoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  manifestoTagline: { fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 1 },

  footer: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 4 },
  footerText: { fontSize: 11, color: Colors.textTertiary, letterSpacing: 1 },
  footerSub: { fontSize: 10, color: Colors.surface3 },
});
