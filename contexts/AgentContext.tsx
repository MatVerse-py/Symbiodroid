import React, { createContext, useState, ReactNode, useCallback } from 'react';
import { AgentRun, executeAgent, LedgerEntry } from '@/services/agentService';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  run?: AgentRun;
}

interface AgentContextType {
  messages: Message[];
  runs: AgentRun[];
  ledger: LedgerEntry[];
  isRunning: boolean;
  currentStep: string;
  currentStepIndex: number;
  totalSteps: number;
  sendPrompt: (prompt: string) => Promise<void>;
  clearMessages: () => void;
}

export const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: 'SYMBIODROID online. Ω-Gate ativo. Todas as ações são registradas no ledger. O que você quer executar?',
      timestamp: Date.now(),
    },
  ]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  const sendPrompt = useCallback(async (prompt: string) => {
    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsRunning(true);
    setCurrentStep('Iniciando Ω-Gate...');
    setCurrentStepIndex(0);
    setTotalSteps(5);

    try {
      const run = await executeAgent(prompt, (stage, stepIndex) => {
        setCurrentStep(stage);
        setCurrentStepIndex(stepIndex + 1);
      });

      setRuns(prev => [run, ...prev]);

      // Add to ledger
      const ledgerEntry: LedgerEntry = {
        id: run.id,
        event: prompt,
        timestamp: run.timestamp,
        status: run.status === 'BLOCK' ? 'BLOCK' : 'PASS',
      };
      setLedger(prev => [ledgerEntry, ...prev.slice(0, 49)]);

      const agentMsg: Message = {
        id: `msg_agent_${Date.now()}`,
        role: 'agent',
        content: run.status === 'BLOCK'
          ? `🛑 Ω-GATE BLOQUEADO\n\n${run.result}`
          : `✅ Execução completa\n\n${run.result}\n\n_Duração: ${((run.duration || 0) / 1000).toFixed(1)}s — ID: ${run.id}_`,
        timestamp: Date.now(),
        run,
      };

      setMessages(prev => [...prev, agentMsg]);
    } finally {
      setIsRunning(false);
      setCurrentStep('');
      setCurrentStepIndex(0);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([{
      id: 'welcome',
      role: 'agent',
      content: 'SYMBIODROID online. Ω-Gate ativo. Todas as ações são registradas no ledger. O que você quer executar?',
      timestamp: Date.now(),
    }]);
  }, []);

  return (
    <AgentContext.Provider value={{
      messages,
      runs,
      ledger,
      isRunning,
      currentStep,
      currentStepIndex,
      totalSteps,
      sendPrompt,
      clearMessages,
    }}>
      {children}
    </AgentContext.Provider>
  );
}
