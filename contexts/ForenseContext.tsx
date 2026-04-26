import React, { createContext, useState, useCallback, ReactNode } from 'react';
import {
  ForenseCase,
  Evidence,
  TimelineEvent,
  ForenseFlag,
  OmegaStatus,
  createCase,
  createEvidence,
  processCase,
  generateDossie,
} from '@/services/forenseService';

interface ForenseContextType {
  cases: ForenseCase[];
  evidenceMap: Record<string, Evidence[]>;
  timelineMap: Record<string, TimelineEvent[]>;
  flagMap: Record<string, ForenseFlag[]>;
  dossieMap: Record<string, string>;
  processingCaseId: string | null;
  processStep: string;
  processStepIndex: number;

  addCase: (title: string, description: string) => ForenseCase;
  addEvidence: (caseId: string, filename: string) => Evidence;
  startProcessing: (caseId: string) => Promise<void>;
  closeCase: (caseId: string) => void;
  deleteCase: (caseId: string) => void;
  reviewEvent: (caseId: string, eventId: string, status: 'confirmed' | 'rejected') => void;
  getDossie: (caseId: string) => string | null;
}

export const ForenseContext = createContext<ForenseContextType | undefined>(undefined);

export function ForenseProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<ForenseCase[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, Evidence[]>>({});
  const [timelineMap, setTimelineMap] = useState<Record<string, TimelineEvent[]>>({});
  const [flagMap, setFlagMap] = useState<Record<string, ForenseFlag[]>>({});
  const [dossieMap, setDossieMap] = useState<Record<string, string>>({});
  const [processingCaseId, setProcessingCaseId] = useState<string | null>(null);
  const [processStep, setProcessStep] = useState('');
  const [processStepIndex, setProcessStepIndex] = useState(0);

  const addCase = useCallback((title: string, description: string): ForenseCase => {
    const newCase = createCase(title, description);
    setCases(prev => [newCase, ...prev]);
    setEvidenceMap(prev => ({ ...prev, [newCase.id]: [] }));
    return newCase;
  }, []);

  const addEvidence = useCallback((caseId: string, filename: string): Evidence => {
    const ev = createEvidence(caseId, filename);
    setEvidenceMap(prev => ({
      ...prev,
      [caseId]: [...(prev[caseId] || []), ev],
    }));
    setCases(prev => prev.map(c =>
      c.id === caseId ? { ...c, totalFiles: (c.totalFiles || 0) + 1, updatedAt: Date.now() } : c
    ));
    return ev;
  }, []);

  const startProcessing = useCallback(async (caseId: string) => {
    const evidences = evidenceMap[caseId] || [];
    setProcessingCaseId(caseId);
    setProcessStep('Iniciando...');
    setProcessStepIndex(0);

    setCases(prev => prev.map(c =>
      c.id === caseId ? { ...c, status: 'processing', updatedAt: Date.now() } : c
    ));

    try {
      const result = await processCase(caseId, evidences, (step, idx) => {
        setProcessStep(step);
        setProcessStepIndex(idx);
      });

      setTimelineMap(prev => ({ ...prev, [caseId]: result.events }));
      setFlagMap(prev => ({ ...prev, [caseId]: result.flags }));

      const forenseCase = cases.find(c => c.id === caseId)!;
      const updatedCase: ForenseCase = {
        ...forenseCase,
        status: 'analyzed',
        totalMessages: result.events.length,
        totalFlags: result.flags.length,
        omegaStatus: result.omegaStatus,
        updatedAt: Date.now(),
      };

      setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));

      const dossie = generateDossie(updatedCase, result.events, result.flags, result.omegaStatus);
      setDossieMap(prev => ({ ...prev, [caseId]: dossie }));
    } finally {
      setProcessingCaseId(null);
      setProcessStep('');
      setProcessStepIndex(0);
    }
  }, [evidenceMap, cases]);

  const closeCase = useCallback((caseId: string) => {
    setCases(prev => prev.map(c =>
      c.id === caseId ? { ...c, status: 'closed', updatedAt: Date.now() } : c
    ));
  }, []);

  const deleteCase = useCallback((caseId: string) => {
    setCases(prev => prev.filter(c => c.id !== caseId));
    setEvidenceMap(prev => { const n = { ...prev }; delete n[caseId]; return n; });
    setTimelineMap(prev => { const n = { ...prev }; delete n[caseId]; return n; });
    setFlagMap(prev => { const n = { ...prev }; delete n[caseId]; return n; });
    setDossieMap(prev => { const n = { ...prev }; delete n[caseId]; return n; });
  }, []);

  const reviewEvent = useCallback((caseId: string, eventId: string, status: 'confirmed' | 'rejected') => {
    setTimelineMap(prev => ({
      ...prev,
      [caseId]: (prev[caseId] || []).map(e =>
        e.id === eventId ? { ...e, reviewStatus: status } : e
      ),
    }));
  }, []);

  const getDossie = useCallback((caseId: string): string | null => {
    return dossieMap[caseId] || null;
  }, [dossieMap]);

  return (
    <ForenseContext.Provider value={{
      cases,
      evidenceMap,
      timelineMap,
      flagMap,
      dossieMap,
      processingCaseId,
      processStep,
      processStepIndex,
      addCase,
      addEvidence,
      startProcessing,
      closeCase,
      deleteCase,
      reviewEvent,
      getDossie,
    }}>
      {children}
    </ForenseContext.Provider>
  );
}
