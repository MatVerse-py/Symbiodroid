import { useContext } from 'react';
import { AgentContext } from '@/contexts/AgentContext';

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) throw new Error('useAgent must be used within AgentProvider');
  return context;
}
