const SHA256 = /^[a-f0-9]{64}$/i;
const SAFE_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/;

export type AcquiredFile = {
  relativePath: string;
  bytes: number;
  sha256: string;
};

export type AcquisitionManifest = {
  schemaVersion: 1;
  tool: 'symbiodroid-rescue';
  mode: 'RESCUE';
  device: {
    serial: string;
    model: string;
    androidVersion: string;
  };
  startedAt: string;
  completedAt: string;
  requestedPaths: string[];
  copiedPaths: string[];
  failedPaths: string[];
  files: AcquiredFile[];
  totals: {
    files: number;
    bytes: number;
  };
  destructiveActions: 0;
};

export type CreateManifestInput = Omit<
  AcquisitionManifest,
  'schemaVersion' | 'tool' | 'mode' | 'totals' | 'destructiveActions' | 'files'
> & {
  files: AcquiredFile[];
};

function assertIso8601(value: string, field: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`INVALID_MANIFEST:${field}`);
}

function validateFile(file: AcquiredFile): void {
  if (!SAFE_RELATIVE_PATH.test(file.relativePath)) {
    throw new Error('INVALID_MANIFEST:relativePath');
  }
  if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) {
    throw new Error('INVALID_MANIFEST:bytes');
  }
  if (!SHA256.test(file.sha256)) throw new Error('INVALID_MANIFEST:sha256');
}

export function createAcquisitionManifest(input: CreateManifestInput): AcquisitionManifest {
  if (!input.device.serial.trim()) throw new Error('INVALID_MANIFEST:serial');
  if (!input.device.model.trim()) throw new Error('INVALID_MANIFEST:model');
  assertIso8601(input.startedAt, 'startedAt');
  assertIso8601(input.completedAt, 'completedAt');
  if (Date.parse(input.completedAt) < Date.parse(input.startedAt)) {
    throw new Error('INVALID_MANIFEST:timeOrder');
  }

  const files = [...input.files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  files.forEach(validateFile);
  const duplicate = files.find((file, index) => file.relativePath === files[index - 1]?.relativePath);
  if (duplicate) throw new Error('INVALID_MANIFEST:duplicatePath');

  return {
    schemaVersion: 1,
    tool: 'symbiodroid-rescue',
    mode: 'RESCUE',
    device: { ...input.device },
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestedPaths: [...input.requestedPaths],
    copiedPaths: [...input.copiedPaths],
    failedPaths: [...input.failedPaths],
    files,
    totals: {
      files: files.length,
      bytes: files.reduce((total, file) => total + file.bytes, 0),
    },
    destructiveActions: 0,
  };
}

export function serializeAcquisitionManifest(manifest: AcquisitionManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
