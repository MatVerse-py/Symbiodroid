export const RESCUE_STATES = [
  'DISCONNECTED',
  'USB_DETECTED',
  'AOA_PROBED',
  'AOA_SUPPORTED',
  'AOA_UNAVAILABLE',
  'HID_READY',
  'ADB_UNAUTHORIZED',
  'ADB_AUTHORIZED',
  'MIRROR_AVAILABLE',
  'ACQUISITION_RUNNING',
  'ACQUISITION_VERIFIED',
  'FAILED_REQUIRES_HARDWARE_REPAIR',
] as const;

export type RescueState = (typeof RESCUE_STATES)[number];

type ProofBase = {
  recordedAt: string;
  source: 'webusb' | 'adb' | 'scrcpy' | 'acquisition' | 'operator';
};

export type UsbDetectedProof = ProofBase & {
  kind: 'usb_detected';
  vendorId: number;
  productId: number;
  productName: string;
};

export type AoaProtocolProof = ProofBase & {
  kind: 'aoa_protocol';
  protocol: number;
};

export type HidRegistrationProof = ProofBase & {
  kind: 'hid_registration';
  keyboardId: number;
  mouseId: number;
};

export type AdbStatusProof = ProofBase & {
  kind: 'adb_status';
  serial: string;
  status: 'unauthorized' | 'device';
};

export type MirrorFrameProof = ProofBase & {
  kind: 'mirror_frame';
  frameSha256: string;
  width: number;
  height: number;
};

export type AcquisitionStartedProof = ProofBase & {
  kind: 'acquisition_started';
  destinationLabel: string;
  requestedPaths: string[];
};

export type AcquisitionManifestProof = ProofBase & {
  kind: 'acquisition_manifest';
  manifestSha256: string;
  fileCount: number;
  totalBytes: number;
  failedPaths: string[];
};

export type HardwareFailureProof = ProofBase & {
  kind: 'hardware_failure';
  reasonCode:
    | 'AOA_UNSUPPORTED'
    | 'USB_RESTRICTED_WHILE_LOCKED'
    | 'DISPLAY_REQUIRED'
    | 'PHYSICAL_USB_FAILURE';
  detail: string;
};

export type RescueProof =
  | UsbDetectedProof
  | AoaProtocolProof
  | HidRegistrationProof
  | AdbStatusProof
  | MirrorFrameProof
  | AcquisitionStartedProof
  | AcquisitionManifestProof
  | HardwareFailureProof;

export type RescueEvent = {
  from: RescueState;
  to: RescueState;
  at: string;
  proofKind: RescueProof['kind'] | 'session_closed';
};

export type RescueSnapshot = {
  schemaVersion: 1;
  sessionId: string;
  state: RescueState;
  createdAt: string;
  updatedAt: string;
  proofs: RescueProof[];
  events: RescueEvent[];
};

export type RescueCapabilities = {
  platform: string;
  secureContext: boolean;
  topLevel: boolean;
  webUsb: boolean;
};
