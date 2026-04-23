import { useContext } from 'react';
import { VaultContext } from '@/contexts/VaultContext';

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used within VaultProvider');
  return context;
}
