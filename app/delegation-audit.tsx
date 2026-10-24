/**
 * Native-only, observation-first readiness screen.
 * This screen CANNOT issue leases, authenticate principals, authorize actions,
 * dispatch effects, or assert WORLD_REAL_PASS.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DurableDelegationJournal } from '../src/delegation/durable-journal';
import { expoSqlitePort } from '../src/delegation/expo-sqlite-port';
import {
  DELEGATION_DATABASE_NAME,
  readDelegationReadiness,
  type DelegationReadiness,
} from '../src/delegation/readiness';

const KAT_INPUT = 'matverse-delegation-readiness-v1';
const KAT_SHA256 = 'be15754f364e47d4d61acec21293f78a765db32dfa7449d94ce5449e577fc09e';
const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
type NativeCheck = 'NÃO TESTADO' | 'PASS' | 'HOLD' | 'FALHOU';

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{title}</Text>
    </View>
  );
}
export default function DelegationAuditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DelegationReadiness | null>(null);
  const [cryptoCheck, setCryptoCheck] = useState<NativeCheck>('NÃO TESTADO');
  const [presenceCheck, setPresenceCheck] = useState<NativeCheck>('NÃO TESTADO');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRunning(true);
    setError(null);
    if (!isNative) {
      setError('Diagnóstico nativo disponível somente em Android/iOS. Execução web bloqueada.');
      setRunning(false);
      return;
    }
    let db: SQLite.SQLiteDatabase | null = null;
    try {
      db = await SQLite.openDatabaseAsync(DELEGATION_DATABASE_NAME);
      const port = expoSqlitePort(db);
      // Bootstrap creates only the local schema; no lease or operation is created.
      await new DurableDelegationJournal(port).initialize();
      const result = await readDelegationReadiness(port);
      setSnapshot(result);
      const actual = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, KAT_INPUT);
      setCryptoCheck(actual.toLowerCase() === KAT_SHA256 ? 'PASS' : 'FALHOU');
    } catch (e) {
      setSnapshot(null);
      setCryptoCheck('HOLD');
      setError(e instanceof Error ? e.message : 'Falha desconhecida no diagnóstico');
    } finally {
      try { await db?.closeAsync(); } catch { /* data source is not trusted on close failure */ }
      setRunning(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const checkLocalPresence = useCallback(async () => {
    // A successful platform prompt is evidence of local presence only.
    // It MUST NOT produce an owner ID, capability lease or remote authentication token.
    if (!isNative) { setPresenceCheck('HOLD'); return; }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) { setPresenceCheck('HOLD'); return; }
      const outcome = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirmar presença local · MatVerse',
        disableDeviceFallback: true,
        biometricsSecurityLevel: 'strong',
      });
      setPresenceCheck(outcome.success ? 'PASS' : 'HOLD');
    } catch {
      setPresenceCheck('HOLD');
    }
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>← Configurações</Text>
        </Pressable>
        <Text style={styles.kicker}>URANO / SYMBIODROID / INSTRUMENTAÇÃO</Text>
        <Text style={styles.heading}>Delegação: diagnóstico local</Text>
        <Text style={styles.intro}>
          Observação de armazenamento, criptografia e presença local. Não concede autoridade,
          não conecta o Ω-Gate e não executa ações no dispositivo.
        </Text>
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>HOLD · Identidade e política não vinculadas</Text>
          <Text style={styles.body}>
            Biometria confirma apenas presença no aparelho. Não comprova identidade do
            proprietário perante o Bridge. Um banco vazio não demonstra integração funcional.
          </Text>
        </View>
        <Text style={styles.section}>Armazenamento SQLite</Text>
        {running ? <ActivityIndicator color="#86e4bc" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {snapshot ? (
          <>
            <View style={styles.metricsRow}>
              <Stat title="Permissões totais" value={snapshot.leases.total} />
              <Stat title="Ativas" value={snapshot.leases.active} />
              <Stat title="Revogadas" value={snapshot.leases.revoked} />
            </View>
            <View style={styles.metricsRow}>
              <Stat title="Ações desconhecidas" value={snapshot.actions.unknown} />
              <Stat title="Despachos reivindicados" value={snapshot.actions.dispatchClaimed} />
              <Stat title="Executadas" value={snapshot.actions.executed} />
            </View>
          </>
        ) : null}
        <Text style={styles.section}>Sinais instrumentados</Text>
        <View style={styles.panel}>
          <Text style={styles.body}>SHA-256 nativo / vetor de teste: {cryptoCheck}</Text>
          <Text style={styles.body}>Presença biométrica local: {presenceCheck}</Text>
          <Text style={styles.body}>Identidade de conta/dispositivo: HOLD</Text>
          <Text style={styles.body}>Ω-Gate canônico: HOLD</Text>
          <Text style={styles.body}>SymbiOS executor real: HOLD</Text>
          <Text style={styles.body}>Criptografia do banco em repouso: NÃO VERIFICADA</Text>
          <Text style={styles.body}>WORLD_REAL_PASS: HOLD</Text>
        </View>
        <Pressable style={styles.button} onPress={() => void refresh()} disabled={running} accessibilityRole="button">
          <Text style={styles.buttonText}>Atualizar diagnóstico local</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void checkLocalPresence()} disabled={running} accessibilityRole="button">
          <Text style={styles.secondaryText}>Testar presença biométrica (opcional)</Text>
        </Pressable>
        <Text style={styles.footnote}>
          O primeiro acesso inicializa um esquema SQLite separado, sem inserir ações nem
          autorizações. Nenhum payload, identificador de agente ou segredo é exibido nesta tela.
        </Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090d12' },
  page: { paddingHorizontal: 22, paddingBottom: 48, gap: 15 },
  back: { color: '#8ebfae', fontSize: 14, paddingVertical: 12 },
  kicker: { color: '#8bb8b3', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  heading: { color: '#f5f7f5', fontSize: 27, fontWeight: '700' },
  intro: { color: '#a2b0b7', fontSize: 14, lineHeight: 21 },
  warning: { padding: 16, borderColor: '#7c6755', borderWidth: 1, borderRadius: 12, backgroundColor: '#211a18', gap: 7 },
  warningTitle: { color: '#efd19d', fontWeight: '700', fontSize: 13 },
  body: { color: '#d2d9d9', fontSize: 13, lineHeight: 20 },
  section: { color: '#ebefed', fontSize: 15, fontWeight: '700', marginTop: 12 },
  metricsRow: { flexDirection: 'row', gap: 9 },
  metric: { flex: 1, backgroundColor: '#132027', borderRadius: 12, padding: 11, alignItems: 'center', justifyContent: 'center', minHeight: 88 },
  metricValue: { color: '#86e4bc', fontSize: 22, fontWeight: '700' },
  metricLabel: { color: '#b2c4c2', fontSize: 10, textAlign: 'center', marginTop: 6 },
  panel: { borderWidth: 1, borderColor: '#30434b', backgroundColor: '#101920', borderRadius: 12, padding: 16, gap: 9 },
  button: { backgroundColor: '#86e4bc', paddingVertical: 15, alignItems: 'center', borderRadius: 10 },
  buttonText: { color: '#052017', fontWeight: '700', fontSize: 13 },
  secondaryButton: { borderColor: '#86e4bc', borderWidth: 1, paddingVertical: 15, alignItems: 'center', borderRadius: 10 },
  secondaryText: { color: '#b9ead7', fontWeight: '600', fontSize: 13 },
  footnote: { color: '#819199', fontSize: 11, lineHeight: 18, marginTop: 8 },
  error: { color: '#efa19f', fontSize: 12 },
});
