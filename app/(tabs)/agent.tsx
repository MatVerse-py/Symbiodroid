import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { useAgent } from '@/hooks/useAgent';
import { OmegaGateIndicator } from '@/components';

const QUICK_PROMPTS = [
  'Analisar e otimizar meu código',
  'Criar plano estratégico de produto',
  'Acessar vault e verificar chaves',
  'Analisar métricas e gerar relatório',
  'Revisão de arquitetura Symbiodroid',
];

export default function AgentScreen() {
  const insets = useSafeAreaInsets();
  const { messages, isRunning, currentStep, currentStepIndex, totalSteps, sendPrompt, clearMessages } = useAgent();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || isRunning) return;
    setInput('');
    await sendPrompt(prompt);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isRunning) return;
    setInput(prompt);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.agentIcon}>
            <Ionicons name="radio" size={18} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.agentName}>OMEGA AGENT</Text>
            <Text style={styles.agentStatus}>
              {isRunning ? '⚡ Executando...' : '✓ Pronto para comandos'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={clearMessages}
          hitSlop={8}
          style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
        </Pressable>
      </View>

      {/* Omega Gate */}
      <View style={styles.gateWrapper}>
        <OmegaGateIndicator
          isActive={isRunning}
          currentStep={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
        />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(msg => (
          <View
            key={msg.id}
            style={[
              styles.msgBubble,
              msg.role === 'user' ? styles.msgUser : styles.msgAgent,
            ]}
          >
            {msg.role === 'agent' ? (
              <View style={styles.agentTag}>
                <Ionicons name="radio" size={10} color={Colors.primary} />
                <Text style={styles.agentTagText}>OMEGA</Text>
              </View>
            ) : null}
            <Text style={[
              styles.msgText,
              msg.role === 'user' ? styles.msgTextUser : styles.msgTextAgent,
              msg.run?.status === 'BLOCK' && styles.msgTextBlock,
            ]}>
              {msg.content}
            </Text>
            <Text style={styles.msgTime}>
              {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}

        {/* Execution Plan Display */}
        {isRunning ? (
          <View style={styles.planCard}>
            <Text style={styles.planTitle}>PLANO DE EXECUÇÃO</Text>
            {[...Array(5)].map((_, i) => (
              <View key={i} style={styles.planStep}>
                <View style={[
                  styles.planDot,
                  i < currentStepIndex ? styles.planDotDone : i === currentStepIndex - 1 ? styles.planDotActive : styles.planDotPending
                ]} />
                <Text style={[
                  styles.planStepText,
                  i < currentStepIndex ? styles.planStepDone : styles.planStepPending
                ]}>
                  {i < currentStepIndex
                    ? currentStep
                    : `Etapa ${i + 1}...`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Quick Prompts */}
      {!isRunning && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickScroll}
          style={styles.quickContainer}
        >
          {QUICK_PROMPTS.map((prompt, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
              onPress={() => handleQuickPrompt(prompt)}
            >
              <Text style={styles.quickChipText} numberOfLines={1}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.inputArea, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="O que você quer executar?"
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            editable={!isRunning}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || isRunning) && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleSend}
            disabled={!input.trim() || isRunning}
          >
            {isRunning ? (
              <Ionicons name="hourglass" size={18} color={Colors.black} />
            ) : (
              <Ionicons name="arrow-up" size={18} color={Colors.black} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agentIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },
  agentStatus: { fontSize: 11, color: Colors.primary, marginTop: 1 },
  clearBtn: { padding: 8 },

  gateWrapper: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },

  messages: { flex: 1 },
  messagesContent: { padding: Spacing.md, gap: 12 },

  msgBubble: {
    maxWidth: '88%',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
  },
  msgUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderBottomRightRadius: 4,
  },
  msgAgent: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  agentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  agentTagText: { fontSize: 9, fontWeight: '700', color: Colors.primary, letterSpacing: 1 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextUser: { color: Colors.textPrimary },
  msgTextAgent: { color: Colors.textSecondary },
  msgTextBlock: { color: Colors.red },
  msgTime: { fontSize: 9, color: Colors.textTertiary, alignSelf: 'flex-end' },

  planCard: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderGold,
    padding: Spacing.md,
    gap: 8,
    maxWidth: '88%',
  },
  planTitle: { fontSize: 9, fontWeight: '700', color: Colors.gold, letterSpacing: 2 },
  planStep: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planDot: { width: 8, height: 8, borderRadius: 4 },
  planDotDone: { backgroundColor: Colors.primary },
  planDotActive: { backgroundColor: Colors.gold },
  planDotPending: { backgroundColor: Colors.surface3 },
  planStepText: { fontSize: 12, flex: 1 },
  planStepDone: { color: Colors.primary },
  planStepPending: { color: Colors.textTertiary },

  quickContainer: { borderTopWidth: 1, borderTopColor: Colors.border },
  quickScroll: { gap: 8, padding: 10, paddingHorizontal: Spacing.md },
  quickChip: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 220,
  },
  quickChipText: { fontSize: 12, color: Colors.textSecondary },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    paddingHorizontal: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surface3 },
});
