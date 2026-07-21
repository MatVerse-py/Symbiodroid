import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import {
  AoaHidSession,
  applyRescueProof,
  createRescueSnapshot,
  createSafeDiagnostic,
  describeAoaError,
  getRescueCapabilities,
  resetRescueSnapshot,
  type AoaProgress,
  type RescueProof,
  type RescueSnapshot,
} from '@/services/rescue';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const STATE_LABELS: Record<RescueSnapshot['state'], string> = {
  DISCONNECTED: 'Aguardando USB',
  USB_DETECTED: 'Samsung detectado',
  AOA_PROBED: 'AOA consultado',
  AOA_SUPPORTED: 'AOA 2.0 confirmado',
  AOA_UNAVAILABLE: 'AOA indisponível',
  HID_READY: 'Teclado e mouse prontos',
  ADB_UNAUTHORIZED: 'ADB sem autorização',
  ADB_AUTHORIZED: 'ADB autorizado',
  MIRROR_AVAILABLE: 'Espelhamento comprovado',
  ACQUISITION_RUNNING: 'Aquisição em andamento',
  ACQUISITION_VERIFIED: 'Aquisição verificada',
  FAILED_REQUIRES_HARDWARE_REPAIR: 'Reparo físico necessário',
};

export default function RescueScreen() {
  const sessionRef = useRef<AoaHidSession | null>(null);
  const snapshotRef = useRef(createRescueSnapshot());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState(snapshotRef.current);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const capabilities = useMemo(() => getRescueCapabilities(), []);
  const hostReady =
    Platform.OS === 'web' &&
    capabilities.webUsb &&
    capabilities.secureContext &&
    capabilities.topLevel;
  const hidReady = snapshot.state === 'HID_READY';

  useEffect(() => {
    return () => {
      void sessionRef.current?.close();
    };
  }, []);

  const recordProof = (proof: RescueProof) => {
    const next = applyRescueProof(snapshotRef.current, proof);
    snapshotRef.current = next;
    setSnapshot(next);
  };

  const onProgress = (progress: AoaProgress) => {
    setLogs((previous) => [...previous, `[${progress.stage}] ${progress.detail}`]);
    if (progress.proof) recordProof(progress.proof);
  };

  const connectHid = async () => {
    setConnecting(true);
    setError(null);
    setCopied(false);
    setLogs([]);
    try {
      if (sessionRef.current) await sessionRef.current.close();
      snapshotRef.current = createRescueSnapshot();
      setSnapshot(snapshotRef.current);
      const session = await AoaHidSession.connect(onProgress);
      sessionRef.current = session;
    } catch (connectionError) {
      setError(describeAoaError(connectionError));
    } finally {
      setConnecting(false);
    }
  };

  const closeSession = async () => {
    await sessionRef.current?.close();
    sessionRef.current = null;
    const next = resetRescueSnapshot(snapshotRef.current);
    snapshotRef.current = next;
    setSnapshot(next);
    setLogs([]);
    setError(null);
  };

  const send = async (operation: (session: AoaHidSession) => Promise<void>) => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      await operation(session);
    } catch (inputError) {
      setError(describeAoaError(inputError));
    }
  };

  const copyDiagnostic = async () => {
    const diagnostic = createSafeDiagnostic(snapshotRef.current, capabilities, error);
    await Clipboard.setStringAsync(diagnostic);
    setCopied(true);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Boolean(sessionRef.current),
        onMoveShouldSetPanResponder: () => Boolean(sessionRef.current),
        onPanResponderGrant: (_event, gesture) => {
          pointerRef.current = { x: gesture.moveX, y: gesture.moveY };
        },
        onPanResponderMove: (_event, gesture) => {
          const previous = pointerRef.current;
          if (!previous) return;
          const deltaX = gesture.moveX - previous.x;
          const deltaY = gesture.moveY - previous.y;
          pointerRef.current = { x: gesture.moveX, y: gesture.moveY };
          if (Math.abs(deltaX) + Math.abs(deltaY) >= 1) {
            void send((session) => session.moveMouse(deltaX, deltaY));
          }
        },
        onPanResponderRelease: () => {
          pointerRef.current = null;
        },
        onPanResponderTerminate: () => {
          pointerRef.current = null;
        },
      }),
    [],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="medkit" size={17} color={Colors.cyan} />
          <Text style={styles.eyebrow}>R1 · BROKEN SCREEN CONTINUITY</Text>
        </View>
        <Text style={styles.title}>Rescue Host</Text>
        <Text style={styles.subtitle}>
          Use o ChromeOS como teclado e mouse USB do Android. Nenhum PIN é salvo, exibido no log
          ou enviado para uma API.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusHeading}>
          <View style={[styles.statusDot, hidReady && styles.statusDotReady]} />
          <View style={styles.statusCopy}>
            <Text style={styles.label}>ESTADO COMPROVADO</Text>
            <Text style={styles.statusText}>{STATE_LABELS[snapshot.state]}</Text>
          </View>
          <Text style={styles.proofCount}>{snapshot.proofs.length} prova(s)</Text>
        </View>

        {!hostReady ? (
          <View style={styles.warning}>
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={styles.warningText}>
              Abra a versão Web diretamente no Chrome/ChromeOS por HTTPS. O app Android não pode
              controlar o próprio USB como host.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={!hostReady || connecting}
          onPress={() => void connectHid()}
          style={({ pressed }) => [
            styles.primaryButton,
            (!hostReady || connecting) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="hardware-chip-outline" size={20} color={Colors.black} />
          <Text style={styles.primaryButtonText}>
            {connecting ? 'Consultando AOA…' : 'Conectar Samsung uma vez'}
          </Text>
        </Pressable>
      </View>

      {hidReady ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>PIN local</Text>
            <Text style={styles.panelDescription}>
              Acorde a tela, digite o PIN abaixo e confirme. As teclas não entram no estado nem no
              diagnóstico.
            </Text>
            <Pressable
              onPress={() => void send((session) => session.sendKey('Space'))}
              style={styles.secondaryButton}
            >
              <Ionicons name="sunny" size={18} color={Colors.warning} />
              <Text style={styles.secondaryButtonText}>Acordar tela</Text>
            </Pressable>
            <View style={styles.keypad}>
              {DIGITS.slice(0, 9).map((digit) => (
                <Pressable
                  key={digit}
                  onPress={() => void send((session) => session.sendDigit(digit))}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                >
                  <Text style={styles.keyText}>{digit}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => void send((session) => session.sendKey('Backspace'))}
                style={({ pressed }) => [styles.key, styles.keyAction, pressed && styles.keyPressed]}
              >
                <Ionicons name="backspace" size={22} color={Colors.warning} />
              </Pressable>
              <Pressable
                onPress={() => void send((session) => session.sendDigit('0'))}
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              >
                <Text style={styles.keyText}>0</Text>
              </Pressable>
              <Pressable
                onPress={() => void send((session) => session.sendKey('Enter'))}
                style={({ pressed }) => [styles.key, styles.keyConfirm, pressed && styles.keyPressed]}
              >
                <Ionicons name="checkmark" size={24} color={Colors.success} />
              </Pressable>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Mouse USB virtual</Text>
            <Text style={styles.panelDescription}>
              Arraste dentro da área para mover o ponteiro no A13. Use clique, Tab e Enter para
              aceitar o diálogo de autorização ADB.
            </Text>
            <View style={styles.touchpad} {...panResponder.panHandlers}>
              <Ionicons name="navigate" size={30} color={Colors.cyan} />
              <Text style={styles.touchpadTitle}>Arraste para mover</Text>
              <Text style={styles.touchpadHint}>O movimento é enviado como mouse HID relativo.</Text>
            </View>
            <View style={styles.actionRow}>
              <ActionButton label="Clique" onPress={() => send((session) => session.click())} />
              <ActionButton label="Tab" onPress={() => send((session) => session.sendKey('Tab'))} />
              <ActionButton
                label="Shift+Tab"
                onPress={() => send((session) => session.sendKey('Tab', true))}
              />
              <ActionButton label="Enter" onPress={() => send((session) => session.sendKey('Enter'))} />
            </View>
            <View style={styles.actionRow}>
              <ActionButton label="←" onPress={() => send((session) => session.sendKey('ArrowLeft'))} />
              <ActionButton label="↑" onPress={() => send((session) => session.sendKey('ArrowUp'))} />
              <ActionButton label="↓" onPress={() => send((session) => session.sendKey('ArrowDown'))} />
              <ActionButton label="→" onPress={() => send((session) => session.sendKey('ArrowRight'))} />
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Diagnóstico seguro</Text>
        <Text style={styles.panelDescription}>
          Registra capacidades, transições e provas técnicas. Serial ADB e destino local são
          redigidos; PIN e teclas nunca são incluídos.
        </Text>
        {logs.length > 0 ? (
          <View style={styles.logBox}>
            {logs.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.logLine}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.footerActions}>
          <Pressable onPress={() => void copyDiagnostic()} style={styles.secondaryButton}>
            <Ionicons name="copy" size={17} color={Colors.cyan} />
            <Text style={styles.secondaryButtonText}>{copied ? 'Copiado' : 'Copiar diagnóstico'}</Text>
          </Pressable>
          {snapshot.state !== 'DISCONNECTED' ? (
            <Pressable onPress={() => void closeSession()} style={styles.dangerButton}>
              <Ionicons name="close-circle" size={17} color={Colors.danger} />
              <Text style={styles.dangerButtonText}>Encerrar ponte</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.scopeNotice}>
        <Text style={styles.scopeTitle}>Limite honesto do R1</Text>
        <Text style={styles.scopeText}>
          Este marco fornece entrada HID pré-ADB e provas de estado. Espelhamento e aquisição só
          podem ser declarados depois de uma chave ADB autorizada e de um teste físico reproduzível.
        </Text>
      </View>
    </ScrollView>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => Promise<void> }) {
  return (
    <Pressable onPress={() => void onPress()} style={({ pressed }) => [styles.actionButton, pressed && styles.keyPressed]}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.surface0 },
  content: { padding: Spacing.md, paddingBottom: 120, gap: Spacing.md },
  hero: { paddingTop: Spacing.lg, gap: Spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eyebrow: { ...Typography.label, color: Colors.cyan },
  title: { ...Typography.display, color: Colors.textPrimary },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, maxWidth: 720 },
  statusCard: {
    backgroundColor: Colors.surface1,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  statusHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 9, height: 9, borderRadius: 99, backgroundColor: Colors.textTertiary },
  statusDotReady: { backgroundColor: Colors.success },
  statusCopy: { flex: 1 },
  label: { ...Typography.label, color: Colors.textTertiary },
  statusText: { ...Typography.heading3, color: Colors.textPrimary, marginTop: 3 },
  proofCount: { ...Typography.caption, color: Colors.cyan },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  warningText: { ...Typography.caption, color: Colors.warning, flex: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,68,68,0.08)',
  },
  errorText: { ...Typography.caption, color: Colors.danger, flex: 1 },
  primaryButton: {
    minHeight: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  primaryButtonText: { ...Typography.bodySmall, color: Colors.black, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
  panel: {
    backgroundColor: Colors.surface1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  panelTitle: { ...Typography.heading2, color: Colors.textPrimary },
  panelDescription: { ...Typography.caption, color: Colors.textSecondary },
  secondaryButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  secondaryButtonText: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  key: {
    width: '31%',
    minHeight: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyAction: { borderColor: Colors.borderGold },
  keyConfirm: { borderColor: Colors.primaryBorder },
  keyPressed: { backgroundColor: Colors.surface3 },
  keyText: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  touchpad: {
    minHeight: 180,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.cyan,
    borderRadius: Radius.md,
    backgroundColor: Colors.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  touchpadTitle: { ...Typography.heading3, color: Colors.textPrimary },
  touchpadHint: { ...Typography.caption, color: Colors.textSecondary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionButton: {
    flexGrow: 1,
    minWidth: 68,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface2,
  },
  actionButtonText: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
  logBox: { backgroundColor: Colors.black, borderRadius: Radius.sm, padding: Spacing.sm, gap: 4 },
  logLine: { ...Typography.mono, color: Colors.cyan, fontSize: 10 },
  footerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dangerButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.35)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dangerButtonText: { ...Typography.caption, color: Colors.danger, fontWeight: '700' },
  scopeNotice: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    paddingLeft: Spacing.md,
    gap: Spacing.xs,
  },
  scopeTitle: { ...Typography.heading3, color: Colors.warning },
  scopeText: { ...Typography.caption, color: Colors.textSecondary },
});
