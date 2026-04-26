// SYMBIOS Evidence OS — Forensic Service Layer (mocked)

export type CaseStatus = 'draft' | 'processing' | 'analyzed' | 'review' | 'closed';
export type EvidenceType = 'whatsapp' | 'print' | 'audio' | 'doc' | 'financial' | 'zip' | 'other';
export type FlagSeverity = 'critical' | 'high' | 'medium' | 'low';
export type OmegaStatus = 'PASS' | 'BLOCK' | 'PENDING' | 'REVIEW';
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';

export interface ForenseCase {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  createdAt: number;
  updatedAt: number;
  totalFiles: number;
  totalMessages: number;
  totalFlags: number;
  omegaStatus: OmegaStatus;
  sovereignSeal: string; // hash
}

export interface Evidence {
  id: string;
  caseId: string;
  filename: string;
  type: EvidenceType;
  sha256: string;
  sizeLabel: string;
  uploadedAt: number;
  status: 'uploaded' | 'processing' | 'extracted' | 'error';
  extractedMessages: number;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: number;
  author: string;
  content: string;
  flags: string[];
  omegaStatus: OmegaStatus;
  sourceHash: string;
  reviewStatus: ReviewStatus;
  evidenceId: string;
}

export interface ForenseFlag {
  id: string;
  caseId: string;
  code: string; // e.g. "SYMBSEC-001"
  label: string;
  description: string;
  severity: FlagSeverity;
  eventId?: string;
  detectedAt: number;
  omegaBlock: boolean;
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function sha256Mock(input: string): string {
  // Mock hash for demo purposes
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0') + '...a3f9e2b1';
}

// ─── CASES ──────────────────────────────────────────────────────────────────

export function createCase(title: string, description: string): ForenseCase {
  const id = `CASE-${Date.now().toString(36).toUpperCase()}`;
  return {
    id,
    title,
    description,
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    totalFiles: 0,
    totalMessages: 0,
    totalFlags: 0,
    omegaStatus: 'PENDING',
    sovereignSeal: sha256Mock(id + title),
  };
}

// ─── EVIDENCE ────────────────────────────────────────────────────────────────

export function detectEvidenceType(filename: string): EvidenceType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.includes('whatsapp') || lower.endsWith('.txt')) return 'whatsapp';
  if (lower.match(/\.(jpg|jpeg|png|webp)$/)) return 'print';
  if (lower.match(/\.(mp3|m4a|ogg|opus|wav)$/)) return 'audio';
  if (lower.match(/\.(pdf|docx|doc)$/)) return 'doc';
  if (lower.match(/\.(xlsx|csv|xls)$/)) return 'financial';
  return 'other';
}

export function createEvidence(caseId: string, filename: string): Evidence {
  return {
    id: genId('ev'),
    caseId,
    filename,
    type: detectEvidenceType(filename),
    sha256: sha256Mock(caseId + filename + Date.now()),
    sizeLabel: `${(Math.random() * 9 + 0.5).toFixed(1)} MB`,
    uploadedAt: Date.now(),
    status: 'uploaded',
    extractedMessages: 0,
  };
}

// ─── PROCESSING (Simulated) ──────────────────────────────────────────────────

export interface ProcessResult {
  events: TimelineEvent[];
  flags: ForenseFlag[];
  omegaStatus: OmegaStatus;
  summary: string;
}

const MOCK_AUTHORS = ['Autor', 'Contraparte', 'Testemunha A', 'Terceiro'];
const MOCK_MESSAGES = [
  'Confirmo o pagamento de R$ 15.000 conforme acordado.',
  'Não posso fazer isso, preciso de mais tempo.',
  'O contrato está assinado, você sabe disso.',
  'Vou processar você se não cumprir.',
  'Aqui está o comprovante que você pediu.',
  'Combinamos R$ 8.500 por mês, por que está cobrado diferente?',
  'Não me lembro de ter dito isso.',
  'Isso foi em março, antes do acordo.',
  'Você tem 48h para responder ou vou ao judiciário.',
  'Aqui o extrato completo mostrando os débitos.',
  'Apaga essa mensagem depois de ler.',
  'Nunca concordei com esses valores.',
];

const FLAG_TEMPLATES: Omit<ForenseFlag, 'id' | 'caseId' | 'eventId' | 'detectedAt'>[] = [
  {
    code: 'SYMBSEC-001',
    label: 'Valor sem comprovante',
    description: 'Menção a valor monetário sem documento ou comprovante associado',
    severity: 'critical',
    omegaBlock: true,
  },
  {
    code: 'SYMBSEC-002',
    label: 'Solicitação de destruição de prova',
    description: 'Instrução para apagar, deletar ou ocultar mensagem ou documento',
    severity: 'critical',
    omegaBlock: true,
  },
  {
    code: 'SYMBSEC-003',
    label: 'Ameaça explícita',
    description: 'Linguagem coercitiva ou ameaça de ação legal/física',
    severity: 'high',
    omegaBlock: false,
  },
  {
    code: 'SYMBSEC-004',
    label: 'Contradição temporal',
    description: 'Declaração contraditória com evento anterior na timeline',
    severity: 'high',
    omegaBlock: false,
  },
  {
    code: 'SYMBSEC-005',
    label: 'Período sem evidência',
    description: 'Lacuna temporal relevante sem mensagens ou documentos',
    severity: 'medium',
    omegaBlock: false,
  },
  {
    code: 'SYMBSEC-006',
    label: 'Valor divergente',
    description: 'Discrepância entre valores mencionados em diferentes evidências',
    severity: 'high',
    omegaBlock: true,
  },
];

export async function processCase(
  caseId: string,
  evidences: Evidence[],
  onProgress?: (step: string, index: number) => void,
): Promise<ProcessResult> {
  const steps = [
    'Verificando integridade SHA-256...',
    'Extraindo mensagens e metadados...',
    'Processando OCR em prints...',
    'Analisando timeline cronológica...',
    'Executando detector de flags SYMBSEC...',
    'Avaliando Ω-Gate...',
    'Gerando dossiê soberano...',
  ];

  for (let i = 0; i < steps.length; i++) {
    onProgress?.(steps[i], i);
    await new Promise(r => setTimeout(r, 700));
  }

  // Generate mock timeline events
  const events: TimelineEvent[] = [];
  const now = Date.now();
  const baseTime = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago

  const numEvents = 8 + Math.floor(Math.random() * 8);
  for (let i = 0; i < numEvents; i++) {
    const ts = baseTime + i * (Math.floor(Math.random() * 3 + 1) * 24 * 60 * 60 * 1000);
    const msgIndex = Math.floor(Math.random() * MOCK_MESSAGES.length);
    const content = MOCK_MESSAGES[msgIndex];
    const author = MOCK_AUTHORS[Math.floor(Math.random() * MOCK_AUTHORS.length)];

    const eventFlags: string[] = [];
    let omegaSt: OmegaStatus = 'PASS';

    if (content.includes('R$') && !content.includes('comprovante') && !content.includes('extrato')) {
      eventFlags.push('SYMBSEC-001');
      omegaSt = 'BLOCK';
    }
    if (content.includes('Apaga') || content.includes('apaga')) {
      eventFlags.push('SYMBSEC-002');
      omegaSt = 'BLOCK';
    }
    if (content.includes('processar') || content.includes('judiciário') || content.includes('48h')) {
      eventFlags.push('SYMBSEC-003');
    }
    if (content.includes('Não me lembro') || content.includes('Nunca concordei')) {
      eventFlags.push('SYMBSEC-004');
    }

    events.push({
      id: genId('ev'),
      caseId,
      timestamp: ts,
      author,
      content,
      flags: eventFlags,
      omegaStatus: omegaSt,
      sourceHash: sha256Mock(content + ts),
      reviewStatus: 'pending',
      evidenceId: evidences[0]?.id || '',
    });
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);

  // Generate flags
  const detectedFlagCodes = new Set<string>();
  events.forEach(ev => ev.flags.forEach(f => detectedFlagCodes.add(f)));

  // Add SYMBSEC-005 (gap) if few events
  if (numEvents < 10) detectedFlagCodes.add('SYMBSEC-005');

  // Add SYMBSEC-006 if financial evidence
  if (evidences.some(e => e.type === 'financial' || e.type === 'whatsapp')) {
    detectedFlagCodes.add('SYMBSEC-006');
  }

  const flags: ForenseFlag[] = FLAG_TEMPLATES
    .filter(t => detectedFlagCodes.has(t.code))
    .map(t => ({
      ...t,
      id: genId('fl'),
      caseId,
      detectedAt: now,
      eventId: events.find(e => e.flags.includes(t.code))?.id,
    }));

  const criticalFlags = flags.filter(f => f.severity === 'critical').length;
  const omegaStatus: OmegaStatus = criticalFlags > 0 ? 'BLOCK' : flags.length > 2 ? 'REVIEW' : 'PASS';

  const summary = omegaStatus === 'BLOCK'
    ? `Ω-Gate BLOQUEADO: ${criticalFlags} flag(s) crítica(s) detectada(s). Conclusão requer revisão humana e comprovação dos itens sinalizados.`
    : omegaStatus === 'REVIEW'
    ? `Ω-Gate em REVISÃO: ${flags.length} irregularidade(s) detectada(s). Recomenda-se validação antes de emitir dossiê.`
    : `Ω-Gate APROVADO: Nenhuma inconsistência crítica detectada. Dossiê pode ser emitido.`;

  return { events, flags, omegaStatus, summary };
}

// ─── REPORT ──────────────────────────────────────────────────────────────────

export function generateDossie(
  forenseCase: ForenseCase,
  events: TimelineEvent[],
  flags: ForenseFlag[],
  omegaStatus: OmegaStatus,
): string {
  const now = new Date().toLocaleString('pt-BR');
  const criticalFlags = flags.filter(f => f.severity === 'critical');
  const highFlags = flags.filter(f => f.severity === 'high');

  return `DOSSIÊ PERICIAL SYMBIOS
══════════════════════════════════════════
CASO: ${forenseCase.id}
TÍTULO: ${forenseCase.title}
DATA: ${now}
HASH SOBERANO: ${forenseCase.sovereignSeal}
Ω-GATE: ${omegaStatus}
══════════════════════════════════════════

SUMÁRIO EXECUTIVO
─────────────────
${forenseCase.description}

Total de eventos analisados: ${events.length}
Flags detectadas: ${flags.length}
  → Críticas: ${criticalFlags.length}
  → Altas: ${highFlags.length}

STATUS Ω-GATE: ${omegaStatus}
${omegaStatus === 'BLOCK' ? '⚠️ CONCLUSÃO BLOQUEADA — Evidências insuficientes ou contraditórias.' : ''}
${omegaStatus === 'REVIEW' ? '⚠️ REVISÃO NECESSÁRIA — Irregularidades detectadas.' : ''}

TIMELINE CRONOLÓGICA
────────────────────
${events.slice(0, 5).map((e, i) => `[${i + 1}] ${new Date(e.timestamp).toLocaleDateString('pt-BR')} — ${e.author}
    "${e.content.slice(0, 80)}${e.content.length > 80 ? '...' : ''}"
    Hash: ${e.sourceHash}
    Ω: ${e.omegaStatus}${e.flags.length > 0 ? ` | Flags: ${e.flags.join(', ')}` : ''}`).join('\n\n')}
${events.length > 5 ? `\n... e mais ${events.length - 5} eventos.` : ''}

FLAGS DETECTADAS
────────────────
${flags.map(f => `[${f.code}] ${f.label} — ${f.severity.toUpperCase()}
    ${f.description}`).join('\n\n')}

CADEIA DE CUSTÓDIA
──────────────────
Todas as evidências foram processadas com geração de hash SHA-256.
A integridade dos dados é garantida pelo SYMBIOS Sovereign Seal.

CONCLUSÃO Ω-GATE
─────────────────
${omegaStatus === 'PASS' ? 'Dossiê aprovado para uso. Todas as evidências verificadas.' : ''}
${omegaStatus === 'BLOCK' ? 'BLOQUEADO: Não emitir conclusão sem resolução das flags críticas.' : ''}
${omegaStatus === 'REVIEW' ? 'Requer revisão humana antes da emissão final.' : ''}

──────────────────────────────────────────
GERADO POR SYMBIOS EVIDENCE OS v1.0
Powered by Omega Engine · MatVerse Platform
Own yourself. Now and later.`;
}

// ─── STATS ────────────────────────────────────────────────────────────────────

export function getForenseSummary(cases: ForenseCase[]) {
  return {
    total: cases.length,
    active: cases.filter(c => c.status === 'processing' || c.status === 'analyzed' || c.status === 'review').length,
    closed: cases.filter(c => c.status === 'closed').length,
    blocked: cases.filter(c => c.omegaStatus === 'BLOCK').length,
    totalFlags: cases.reduce((s, c) => s + c.totalFlags, 0),
  };
}
