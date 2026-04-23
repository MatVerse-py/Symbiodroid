import React, { createContext, useState, ReactNode, useCallback } from 'react';
import {
  VaultEntry,
  getVaultEntries,
  addVaultEntry,
  deleteVaultEntry,
} from '@/services/vaultService';

interface VaultContextType {
  entries: VaultEntry[];
  isLocked: boolean;
  unlock: () => void;
  lock: () => void;
  addEntry: (title: string, content: string, category: VaultEntry['category'], tags: string[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredEntries: VaultEntry[];
}

export const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<VaultEntry[]>(getVaultEntries());
  const [isLocked, setIsLocked] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = entries.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const unlock = useCallback(() => setIsLocked(false), []);
  const lock = useCallback(() => setIsLocked(true), []);

  const addEntry = useCallback(async (
    title: string,
    content: string,
    category: VaultEntry['category'],
    tags: string[]
  ) => {
    const entry = await addVaultEntry(title, content, category, tags);
    setEntries(prev => [entry, ...prev]);
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    await deleteVaultEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  return (
    <VaultContext.Provider value={{
      entries,
      isLocked,
      unlock,
      lock,
      addEntry,
      removeEntry,
      searchQuery,
      setSearchQuery,
      filteredEntries,
    }}>
      {children}
    </VaultContext.Provider>
  );
}
