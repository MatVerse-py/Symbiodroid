import type {
  RescueCapabilities,
  RescueEvent,
  RescueProof,
  RescueSnapshot,
  RescueState,
} from './types';

type Clock = () => string;

const HEX_256 = /^[a-f0-9]{64}$/i;

const ALLOWED_TRANSITIONS: Record<RescueState, readonly RescueState[]> = {
  DISCONNECTED: ['USB_DETECTED'],
  USB_DETECTED: ['AOA_PROBED', 'ADB_UNAUTHORIZED', 'ADB_AUTHORIZED', 'DISCONNECTED'],
  AOA_PROBED: ['AOA_SUPPORTED', 'AOA_UNAVAILABLE', 'DISCONNECTED'],
  AOA_SUPPORTED: ['HID_READY', 'DISCONNECTED'],
  AOA_UNAVAILABLE: ['FAILED_REQUIRES_HARDWARE_REPAIR', 'DISCONNECTED'],
  HID_READY: ['ADB_UNAUTHORIZED', 'ADB_AUTHORIZED', 'FAILED_REQUIRES_HARDWARE_REPAIR', 'DISCONNECTED'],
  ADB_UNAUTHORIZED: ['HID_READY', 'ADB_AUTHORIZED', 'FAILED_REQUIRES_HARDWARE_REPAIR', 'DISCONNECTED'],
  ADB_AUTHORIZED: ['MIRROR_AVAILABLE', 'ACQUISITION_RUNNING', 'DISCONNECTED'],
  MIRROR_AVAILABLE: ['ACQUISITION_RUNNING', 'DISCONNECTED'],
  ACQUISITION_RUNNING: ['ACQUISITION_VERIFIED', 'ADB_AUTHORIZED', 'DISCONNECTED'],
  ACQUISITION_VERIFIED: ['MIRROR_AVAILABLE', 'DISCONNECTED'],
  FAILED_REQUIRES_HARDWARE_REPAIR: ['DISCONNECTED'],
};

function isoNow(): string {
  return new Date().toISOString();
}

function makeSessionId(at: string): string {
  return `rescue-${at.replace(/[^0-9]/g, '').slice(0, 17)}`;
}

export function createRescueSnapshot(clock: Clock = isoNow): RescueSnapshot {
  const at = clock();
  return {
    schemaVersion: 1,
    sessionId: makeSessionId(at),
    state: 'DISCONNECTED',
    createdAt: at,
    updatedAt: at,
    proofs: [],
    events: [],
  };
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`INVALID_PROOF:${field}`);
  }
}

function validateProof(proof: RescueProof): void {
  if (!proof.recordedAt || !proof.source) throw new Error('INVALID_PROOF:metadata');

  switch (proof.kind) {
    case 'usb_detected':
      assertPositiveInteger(proof.vendorId, 'vendorId');
      assertPositiveInteger(proof.productId, 'productId');
      if (!proof.productName.trim()) throw new Error('INVALID_PROOF:productName');
      return;
    case 'aoa_protocol':
      assertPositiveInteger(proof.protocol, 'protocol');
      return;
    case 'hid_registration':
      assertPositiveInteger(proof.keyboardId, 'keyboardId');
      assertPositiveInteger(proof.mouseId, 'mouseId');
      if (proof.keyboardId === proof.mouseId) throw new Error('INVALID_PROOF:hidIds');
      return;
    case 'adb_status':
      if (!proof.serial.trim()) throw new Error('INVALID_PROOF:serial');
      return;
    case 'mirror_frame':
      if (!HEX_256.test(proof.frameSha256)) throw new Error('INVALID_PROOF:frameSha256');
      if (proof.width < 1 || proof.height < 1) throw new Error('INVALID_PROOF:frameSize');
      return;
    case 'acquisition_started':
      if (!proof.destinationLabel.trim()) throw new Error('INVALID_PROOF:destinationLabel');
      if (proof.requestedPaths.length === 0) throw new Error('INVALID_PROOF:requestedPaths');
      return;
    case 'acquisition_manifest':
      if (!HEX_256.test(proof.manifestSha256)) throw new Error('INVALID_PROOF:manifestSha256');
      assertPositiveInteger(proof.fileCount, 'fileCount');
      if (proof.fileCount < 1) throw new Error('INVALID_PROOF:fileCount');
      assertPositiveInteger(proof.totalBytes, 'totalBytes');
      return;
    case 'hardware_failure':
      if (!proof.detail.trim()) throw new Error('INVALID_PROOF:failureDetail');
      return;
  }
}

function transition(
  snapshot: RescueSnapshot,
  to: RescueState,
  proof: RescueProof,
  at: string,
): RescueSnapshot {
  if (!ALLOWED_TRANSITIONS[snapshot.state].includes(to)) {
    throw new Error(`INVALID_TRANSITION:${snapshot.state}->${to}`);
  }

  const event: RescueEvent = {
    from: snapshot.state,
    to,
    at,
    proofKind: proof.kind,
  };

  return {
    ...snapshot,
    state: to,
    updatedAt: at,
    events: [...snapshot.events, event],
  };
}

export function applyRescueProof(
  snapshot: RescueSnapshot,
  proof: RescueProof,
  clock: Clock = isoNow,
): RescueSnapshot {
  validateProof(proof);
  const at = clock();
  let next = { ...snapshot, proofs: [...snapshot.proofs, proof] };

  switch (proof.kind) {
    case 'usb_detected':
      return transition(next, 'USB_DETECTED', proof, at);
    case 'aoa_protocol':
      next = transition(next, 'AOA_PROBED', proof, at);
      return transition(next, proof.protocol >= 2 ? 'AOA_SUPPORTED' : 'AOA_UNAVAILABLE', proof, at);
    case 'hid_registration':
      return transition(next, 'HID_READY', proof, at);
    case 'adb_status':
      return transition(next, proof.status === 'device' ? 'ADB_AUTHORIZED' : 'ADB_UNAUTHORIZED', proof, at);
    case 'mirror_frame':
      return transition(next, 'MIRROR_AVAILABLE', proof, at);
    case 'acquisition_started':
      return transition(next, 'ACQUISITION_RUNNING', proof, at);
    case 'acquisition_manifest':
      return transition(next, 'ACQUISITION_VERIFIED', proof, at);
    case 'hardware_failure':
      return transition(next, 'FAILED_REQUIRES_HARDWARE_REPAIR', proof, at);
  }
}

export function resetRescueSnapshot(
  snapshot: RescueSnapshot,
  clock: Clock = isoNow,
): RescueSnapshot {
  if (snapshot.state === 'DISCONNECTED') return createRescueSnapshot(clock);
  const at = clock();
  const event: RescueEvent = {
    from: snapshot.state,
    to: 'DISCONNECTED',
    at,
    proofKind: 'session_closed',
  };
  return {
    ...createRescueSnapshot(() => at),
    events: [...snapshot.events, event],
  };
}

export function createSafeDiagnostic(
  snapshot: RescueSnapshot,
  capabilities: RescueCapabilities,
  error?: string | null,
): string {
  const safeProofs = snapshot.proofs.map((proof) => {
    if (proof.kind === 'adb_status') {
      return { ...proof, serial: proof.serial ? '[present]' : '[missing]' };
    }
    if (proof.kind === 'acquisition_started') {
      return { ...proof, destinationLabel: '[local destination]' };
    }
    return proof;
  });

  return JSON.stringify(
    {
      tool: 'symbiodroid-rescue',
      schemaVersion: snapshot.schemaVersion,
      sessionId: snapshot.sessionId,
      state: snapshot.state,
      capabilities,
      events: snapshot.events,
      proofs: safeProofs,
      error: error || null,
      secretsIncluded: false,
    },
    null,
    2,
  );
}
