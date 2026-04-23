import { AppConfig } from '@/constants/config';

export interface AgentRun {
  id: string;
  prompt: string;
  status: 'PASS' | 'BLOCK' | 'RUNNING' | 'DONE';
  plan: string[];
  result?: string;
  timestamp: number;
  duration?: number;
  skillId?: string;
}

export interface LedgerEntry {
  id: string;
  event: string;
  timestamp: number;
  status: 'PASS' | 'BLOCK';
}

// Omega Gate — safety governance filter
export function omegaGate(prompt: string): { pass: boolean; reason?: string } {
  const lower = prompt.toLowerCase();
  for (const term of AppConfig.omegaGateBannedTerms) {
    if (lower.includes(term)) {
      return { pass: false, reason: `Bloqueado: "${term}" não permitido` };
    }
  }
  return { pass: true };
}

// Generate execution plan based on prompt
function generatePlan(prompt: string): string[] {
  const lower = prompt.toLowerCase();

  if (lower.includes('código') || lower.includes('code') || lower.includes('bug')) {
    return [
      'Analisar repositório e contexto',
      'Identificar padrões e problemas',
      'Gerar solução otimizada',
      'Validar e aplicar patch',
      'Registrar no ledger',
    ];
  }
  if (lower.includes('plano') || lower.includes('estratégia') || lower.includes('startup')) {
    return [
      'Mapear contexto e objetivos',
      'Analisar mercado e competidores',
      'Gerar framework estratégico',
      'Priorizar ações por impacto',
      'Documentar e persistir decisões',
    ];
  }
  if (lower.includes('vault') || lower.includes('seguro') || lower.includes('criptograf')) {
    return [
      'Verificar permissões de acesso',
      'Autenticar identidade',
      'Abrir vault seguro',
      'Executar operação solicitada',
      'Fechar e assinar ledger',
    ];
  }
  if (lower.includes('analise') || lower.includes('dados') || lower.includes('relatório')) {
    return [
      'Coletar fontes de dados',
      'Processar e normalizar',
      'Executar análise profunda',
      'Gerar insights e visualizações',
      'Exportar relatório',
    ];
  }
  return [
    'Analisar intenção',
    'Selecionar skills relevantes',
    'Executar automação',
    'Validar resultado',
    'Registrar no ledger',
  ];
}

// Generate mock result
function generateResult(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('código') || lower.includes('code')) {
    return 'Análise completa. 3 otimizações identificadas. Patch gerado com 94% de confiança. Ledger atualizado.';
  }
  if (lower.includes('plano') || lower.includes('estratégia')) {
    return 'Plano estratégico gerado. 5 ações prioritárias definidas. ROI projetado em 3.2x. Documentado no vault.';
  }
  if (lower.includes('vault')) {
    return 'Vault acessado com sucesso. 12 entradas encontradas. Integridade verificada. Sessão segura encerrada.';
  }
  return 'Tarefa executada com sucesso. Resultado validado pelo Ω-Gate. Entrada registrada no ledger.';
}

export async function executeAgent(
  prompt: string,
  onProgress: (stage: string, stepIndex: number) => void
): Promise<AgentRun> {
  const id = `run_${Date.now()}`;
  const startTime = Date.now();

  // Check Omega Gate
  const gate = omegaGate(prompt);
  if (!gate.pass) {
    return {
      id,
      prompt,
      status: 'BLOCK',
      plan: [],
      result: gate.reason,
      timestamp: startTime,
      duration: 0,
    };
  }

  const plan = generatePlan(prompt);

  // Simulate step-by-step execution
  for (let i = 0; i < plan.length; i++) {
    onProgress(plan[i], i);
    await delay(600 + Math.random() * 400);
  }

  const duration = Date.now() - startTime;
  const result = generateResult(prompt);

  return {
    id,
    prompt,
    status: 'DONE',
    plan,
    result,
    timestamp: startTime,
    duration,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock system metrics
export function getSystemMetrics() {
  return {
    agentRuns: 312,
    successRate: 97.4,
    blockedRequests: 8,
    memoryEntries: 847,
    vaultFiles: 23,
    activeSkills: 4,
    uptime: '99.9%',
    lastSync: Date.now() - 300000,
  };
}
