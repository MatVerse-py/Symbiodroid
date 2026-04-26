import { useContext } from 'react';
import { ForenseContext } from '@/contexts/ForenseContext';

export function useForense() {
  const context = useContext(ForenseContext);
  if (!context) throw new Error('useForense must be used within ForenseProvider');
  return context;
}
