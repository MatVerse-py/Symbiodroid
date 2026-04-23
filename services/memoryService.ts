export interface MemoryEntry {
  id: string;
  content: string;
  skillId: string;
  tags: string[];
  createdAt: number;
  importance: 'low' | 'medium' | 'high';
}

const MOCK_MEMORY: MemoryEntry[] = [
  {
    id: 'm1',
    content: 'Usuário prefere TypeScript com strict mode ativado',
    skillId: 'coding',
    tags: ['preferences', 'typescript'],
    createdAt: Date.now() - 86400000,
    importance: 'high',
  },
  {
    id: 'm2',
    content: 'Stack principal: Turborepo + FastAPI + Expo + Supabase',
    skillId: 'coding',
    tags: ['stack', 'architecture'],
    createdAt: Date.now() - 172800000,
    importance: 'high',
  },
  {
    id: 'm3',
    content: 'Produto principal público: OmegaCoder. Plataforma interna: Symbios',
    skillId: 'founder',
    tags: ['strategy', 'products'],
    createdAt: Date.now() - 259200000,
    importance: 'high',
  },
  {
    id: 'm4',
    content: 'Fase 1 (7 dias): app shell + chat + backend local + ledger',
    skillId: 'founder',
    tags: ['roadmap', 'phase1'],
    createdAt: Date.now() - 345600000,
    importance: 'medium',
  },
  {
    id: 'm5',
    content: 'Monorepo: symbios/ com apps, packages, services, infra',
    skillId: 'coding',
    tags: ['monorepo', 'structure'],
    createdAt: Date.now() - 432000000,
    importance: 'medium',
  },
];

export function getMemoryEntries(skillId?: string): MemoryEntry[] {
  if (skillId) return MOCK_MEMORY.filter(m => m.skillId === skillId);
  return MOCK_MEMORY;
}

export function getMemoryStats() {
  return {
    total: MOCK_MEMORY.length,
    high: MOCK_MEMORY.filter(m => m.importance === 'high').length,
    medium: MOCK_MEMORY.filter(m => m.importance === 'medium').length,
    low: MOCK_MEMORY.filter(m => m.importance === 'low').length,
  };
}
