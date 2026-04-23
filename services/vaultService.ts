export interface VaultEntry {
  id: string;
  title: string;
  category: 'key' | 'doc' | 'note' | 'credential' | 'code';
  preview: string;
  size: string;
  encrypted: boolean;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

const MOCK_VAULT: VaultEntry[] = [
  {
    id: 'v1',
    title: 'Chaves API — Produção',
    category: 'key',
    preview: 'sk-••••••••••••••••••••••••ABCD',
    size: '2.1 KB',
    encrypted: true,
    createdAt: Date.now() - 864000000,
    updatedAt: Date.now() - 3600000,
    tags: ['openai', 'stripe', 'supabase'],
  },
  {
    id: 'v2',
    title: 'Symbiodroid Architecture v2',
    category: 'doc',
    preview: 'Documento de arquitetura completa do sistema Symbios...',
    size: '48.3 KB',
    encrypted: true,
    createdAt: Date.now() - 432000000,
    updatedAt: Date.now() - 7200000,
    tags: ['architecture', 'v2', 'private'],
  },
  {
    id: 'v3',
    title: 'OmegaCoder — Prompts Sistema',
    category: 'code',
    preview: 'SYSTEM: You are OmegaCoder, an expert coding agent...',
    size: '12.7 KB',
    encrypted: true,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 1800000,
    tags: ['prompts', 'omegacoder', 'system'],
  },
  {
    id: 'v4',
    title: 'Credenciais — AWS S3',
    category: 'credential',
    preview: 'Access Key: AKIA••••••••WXYZ',
    size: '0.8 KB',
    encrypted: true,
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 86400000,
    tags: ['aws', 'storage', 's3'],
  },
  {
    id: 'v5',
    title: 'Notas Estratégicas Q2',
    category: 'note',
    preview: 'Foco: OmegaCoder launch + Symbios mobile beta...',
    size: '5.2 KB',
    encrypted: true,
    createdAt: Date.now() - 604800000,
    updatedAt: Date.now() - 43200000,
    tags: ['strategy', 'q2', 'private'],
  },
];

export function getVaultEntries(): VaultEntry[] {
  return MOCK_VAULT;
}

export function getVaultStats() {
  return {
    totalEntries: MOCK_VAULT.length,
    totalSize: '69.1 KB',
    encrypted: MOCK_VAULT.filter(e => e.encrypted).length,
    categories: {
      key: MOCK_VAULT.filter(e => e.category === 'key').length,
      doc: MOCK_VAULT.filter(e => e.category === 'doc').length,
      note: MOCK_VAULT.filter(e => e.category === 'note').length,
      credential: MOCK_VAULT.filter(e => e.category === 'credential').length,
      code: MOCK_VAULT.filter(e => e.category === 'code').length,
    },
  };
}

export async function addVaultEntry(
  title: string,
  content: string,
  category: VaultEntry['category'],
  tags: string[]
): Promise<VaultEntry> {
  const entry: VaultEntry = {
    id: `v${Date.now()}`,
    title,
    category,
    preview: content.substring(0, 60) + '...',
    size: `${(content.length / 1024).toFixed(1)} KB`,
    encrypted: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags,
  };
  MOCK_VAULT.unshift(entry);
  return entry;
}

export async function deleteVaultEntry(id: string): Promise<void> {
  const idx = MOCK_VAULT.findIndex(e => e.id === id);
  if (idx > -1) MOCK_VAULT.splice(idx, 1);
}
