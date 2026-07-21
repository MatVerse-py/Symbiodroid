import type {
  AoaProtocolProof,
  HidRegistrationProof,
  RescueCapabilities,
  RescueProof,
  UsbDetectedProof,
} from './types';

const SAMSUNG_VENDOR_ID = 0x04e8;
const AOA_GET_PROTOCOL = 51;
const AOA_REGISTER_HID = 54;
const AOA_UNREGISTER_HID = 55;
const AOA_SET_HID_REPORT_DESCRIPTOR = 56;
const AOA_SEND_HID_EVENT = 57;

const KEYBOARD_ID = 1;
const MOUSE_ID = 2;

const KEYBOARD_DESCRIPTOR = new Uint8Array([
  0x05, 0x01, 0x09, 0x06, 0xa1, 0x01, 0x05, 0x07,
  0x19, 0xe0, 0x29, 0xe7, 0x15, 0x00, 0x25, 0x01,
  0x75, 0x01, 0x95, 0x08, 0x81, 0x02, 0x95, 0x01,
  0x75, 0x08, 0x81, 0x01, 0x95, 0x05, 0x75, 0x01,
  0x05, 0x08, 0x19, 0x01, 0x29, 0x05, 0x91, 0x02,
  0x95, 0x01, 0x75, 0x03, 0x91, 0x01, 0x95, 0x06,
  0x75, 0x08, 0x15, 0x00, 0x25, 0x65, 0x05, 0x07,
  0x19, 0x00, 0x29, 0x65, 0x81, 0x00, 0xc0,
]);

const MOUSE_DESCRIPTOR = new Uint8Array([
  0x05, 0x01, 0x09, 0x02, 0xa1, 0x01, 0x09, 0x01,
  0xa1, 0x00, 0x05, 0x09, 0x19, 0x01, 0x29, 0x03,
  0x15, 0x00, 0x25, 0x01, 0x95, 0x03, 0x75, 0x01,
  0x81, 0x02, 0x95, 0x01, 0x75, 0x05, 0x81, 0x01,
  0x05, 0x01, 0x09, 0x30, 0x09, 0x31, 0x09, 0x38,
  0x15, 0x81, 0x25, 0x7f, 0x75, 0x08, 0x95, 0x03,
  0x81, 0x06, 0xc0, 0xc0,
]);

const HID_KEYS = {
  Enter: 0x28,
  Escape: 0x29,
  Backspace: 0x2a,
  Tab: 0x2b,
  Space: 0x2c,
  ArrowRight: 0x4f,
  ArrowLeft: 0x50,
  ArrowDown: 0x51,
  ArrowUp: 0x52,
} as const;

const DIGIT_KEYS: Record<string, number> = {
  '1': 0x1e,
  '2': 0x1f,
  '3': 0x20,
  '4': 0x21,
  '5': 0x22,
  '6': 0x23,
  '7': 0x24,
  '8': 0x25,
  '9': 0x26,
  '0': 0x27,
};

type TransferStatus = 'ok' | 'stall' | 'babble';

type ControlSetup = {
  recipient: 'device';
  requestType: 'vendor';
  request: number;
  value: number;
  index: number;
};

export type RescueUsbDevice = {
  opened: boolean;
  vendorId: number;
  productId: number;
  productName?: string | null;
  open: () => Promise<void>;
  close: () => Promise<void>;
  controlTransferIn: (
    setup: ControlSetup,
    length: number,
  ) => Promise<{ status: TransferStatus; data?: DataView | null }>;
  controlTransferOut: (
    setup: ControlSetup,
    data?: Uint8Array,
  ) => Promise<{ status: TransferStatus }>;
};

type UsbManager = {
  requestDevice: (options: {
    filters: Array<{ vendorId: number }>;
  }) => Promise<RescueUsbDevice>;
};

export type AoaProgressStage =
  | 'picker'
  | 'open'
  | 'protocol'
  | 'keyboard'
  | 'mouse'
  | 'ready';

export type AoaProgress = {
  stage: AoaProgressStage;
  detail: string;
  proof?: RescueProof;
};

type ProgressListener = (progress: AoaProgress) => void;

function now(): string {
  return new Date().toISOString();
}

function getUsbManager(): UsbManager {
  const runtime = globalThis as typeof globalThis & {
    navigator?: { usb?: UsbManager };
  };
  const usb = runtime.navigator?.usb;
  if (!usb) throw new Error('WEBUSB_UNAVAILABLE');
  return usb;
}

export function getRescueCapabilities(): RescueCapabilities {
  const runtime = globalThis as typeof globalThis & {
    navigator?: { usb?: UsbManager; userAgent?: string };
    isSecureContext?: boolean;
    top?: unknown;
    self?: unknown;
  };
  return {
    platform: runtime.navigator?.userAgent || 'unknown',
    secureContext: runtime.isSecureContext === true,
    topLevel: runtime.top === undefined || runtime.top === runtime.self,
    webUsb: Boolean(runtime.navigator?.usb),
  };
}

function setup(request: number, value: number, index: number): ControlSetup {
  return {
    recipient: 'device',
    requestType: 'vendor',
    request,
    value,
    index,
  };
}

async function controlOut(
  device: RescueUsbDevice,
  request: number,
  value: number,
  index: number,
  data?: Uint8Array,
): Promise<void> {
  const result = await device.controlTransferOut(setup(request, value, index), data);
  if (result.status !== 'ok') {
    throw new Error(`AOA_CONTROL_${request}_${result.status.toUpperCase()}`);
  }
}

async function getProtocol(device: RescueUsbDevice): Promise<number> {
  const result = await device.controlTransferIn(setup(AOA_GET_PROTOCOL, 0, 0), 2);
  if (result.status !== 'ok' || !result.data || result.data.byteLength < 2) {
    throw new Error(`AOA_CONTROL_${AOA_GET_PROTOCOL}_${result.status.toUpperCase()}`);
  }
  return result.data.getUint16(0, true);
}

async function registerHid(
  device: RescueUsbDevice,
  id: number,
  descriptor: Uint8Array,
): Promise<void> {
  await controlOut(device, AOA_REGISTER_HID, id, descriptor.byteLength);
  await controlOut(device, AOA_SET_HID_REPORT_DESCRIPTOR, id, 0, descriptor);
}

function clampAxis(value: number): number {
  return Math.max(-127, Math.min(127, Math.round(value)));
}

function signedByte(value: number): number {
  return value < 0 ? 256 + value : value;
}

export class AoaHidSession {
  readonly device: RescueUsbDevice;
  readonly protocol: number;
  readonly productName: string;
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;

  private constructor(device: RescueUsbDevice, protocol: number) {
    this.device = device;
    this.protocol = protocol;
    this.productName = device.productName || 'Samsung Android';
  }

  static async connect(onProgress?: ProgressListener): Promise<AoaHidSession> {
    const usb = getUsbManager();
    onProgress?.({ stage: 'picker', detail: 'Aguardando seleção do Samsung no Chrome' });

    const device = await usb.requestDevice({
      filters: [{ vendorId: SAMSUNG_VENDOR_ID }],
    });

    if (!device.opened) await device.open();
    const usbProof: UsbDetectedProof = {
      kind: 'usb_detected',
      source: 'webusb',
      recordedAt: now(),
      vendorId: device.vendorId,
      productId: device.productId,
      productName: device.productName || 'Samsung Android',
    };
    onProgress?.({
      stage: 'open',
      detail: `${usbProof.productName} conectado`,
      proof: usbProof,
    });

    let keyboardRegistered = false;
    try {
      const protocol = await getProtocol(device);
      const protocolProof: AoaProtocolProof = {
        kind: 'aoa_protocol',
        source: 'webusb',
        recordedAt: now(),
        protocol,
      };
      onProgress?.({
        stage: 'protocol',
        detail: `AOA ${protocol}.0 detectado`,
        proof: protocolProof,
      });
      if (protocol < 2) throw new Error(`AOA_VERSION_${protocol}`);

      await registerHid(device, KEYBOARD_ID, KEYBOARD_DESCRIPTOR);
      keyboardRegistered = true;
      onProgress?.({ stage: 'keyboard', detail: 'Teclado HID registrado' });

      await registerHid(device, MOUSE_ID, MOUSE_DESCRIPTOR);
      onProgress?.({ stage: 'mouse', detail: 'Mouse HID registrado' });

      const hidProof: HidRegistrationProof = {
        kind: 'hid_registration',
        source: 'webusb',
        recordedAt: now(),
        keyboardId: KEYBOARD_ID,
        mouseId: MOUSE_ID,
      };
      onProgress?.({
        stage: 'ready',
        detail: 'Ponte HID pronta sem alterar o modo USB',
        proof: hidProof,
      });
      return new AoaHidSession(device, protocol);
    } catch (error) {
      if (keyboardRegistered) {
        try {
          await controlOut(device, AOA_UNREGISTER_HID, KEYBOARD_ID, 0);
        } catch {
          // Preserve the original connection error.
        }
      }
      try {
        await device.close();
      } catch {
        // Preserve the original connection error.
      }
      throw error;
    }
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#closed) return Promise.reject(new Error('AOA_SESSION_CLOSED'));
    const result = this.#queue.then(operation, operation);
    this.#queue = result.catch(() => undefined);
    return result;
  }

  #sendKeyboard(keyCode: number, modifier = 0): Promise<void> {
    return this.#enqueue(async () => {
      await controlOut(
        this.device,
        AOA_SEND_HID_EVENT,
        KEYBOARD_ID,
        0,
        new Uint8Array([modifier, 0, keyCode, 0, 0, 0, 0, 0]),
      );
      await controlOut(
        this.device,
        AOA_SEND_HID_EVENT,
        KEYBOARD_ID,
        0,
        new Uint8Array(8),
      );
    });
  }

  sendDigit(digit: string): Promise<void> {
    const keyCode = DIGIT_KEYS[digit];
    if (!keyCode) return Promise.reject(new Error('INVALID_DIGIT'));
    return this.#sendKeyboard(keyCode);
  }

  sendKey(key: keyof typeof HID_KEYS, withShift = false): Promise<void> {
    return this.#sendKeyboard(HID_KEYS[key], withShift ? 0x02 : 0);
  }

  moveMouse(deltaX: number, deltaY: number): Promise<void> {
    const x = clampAxis(deltaX);
    const y = clampAxis(deltaY);
    return this.#enqueue(() =>
      controlOut(
        this.device,
        AOA_SEND_HID_EVENT,
        MOUSE_ID,
        0,
        new Uint8Array([0, signedByte(x), signedByte(y), 0]),
      ),
    );
  }

  click(): Promise<void> {
    return this.#enqueue(async () => {
      await controlOut(
        this.device,
        AOA_SEND_HID_EVENT,
        MOUSE_ID,
        0,
        new Uint8Array([1, 0, 0, 0]),
      );
      await controlOut(
        this.device,
        AOA_SEND_HID_EVENT,
        MOUSE_ID,
        0,
        new Uint8Array(4),
      );
    });
  }

  scroll(direction: -1 | 1): Promise<void> {
    return this.#enqueue(() =>
      controlOut(
        this.device,
        AOA_SEND_HID_EVENT,
        MOUSE_ID,
        0,
        new Uint8Array([0, 0, 0, signedByte(direction * 3)]),
      ),
    );
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    try {
      await controlOut(this.device, AOA_UNREGISTER_HID, KEYBOARD_ID, 0);
      await controlOut(this.device, AOA_UNREGISTER_HID, MOUSE_ID, 0);
    } catch {
      // The device can re-enumerate when USB debugging is enabled.
    }
    try {
      await this.device.close();
    } catch {
      // The browser can close the device first.
    }
  }
}

export function describeAoaError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);

  if (name === 'NotFoundError') return 'Seleção cancelada ou Samsung não encontrado.';
  if (name === 'SecurityError' || name === 'NotAllowedError') {
    return 'Abra a página diretamente em uma guia segura do Chrome e permita o USB.';
  }
  if (message.includes('WEBUSB_UNAVAILABLE')) {
    return 'WebUSB indisponível. O modo Rescue Host funciona no Chrome/ChromeOS, não dentro do app Android.';
  }
  if (message.startsWith('AOA_VERSION_')) return 'O aparelho não anunciou AOA 2.0.';
  if (/AOA_CONTROL_51_/.test(message)) {
    return 'O Samsung abriu, mas recusou a consulta AOA. Feche Arquivos e outros aplicativos USB.';
  }
  if (/AOA_CONTROL_(54|56)_/.test(message)) {
    return 'AOA 2.0 respondeu, mas o aparelho recusou o HID; a proteção USB na tela bloqueada pode estar ativa.';
  }
  if (/AOA_CONTROL_57_/.test(message)) return 'A ponte abriu, mas o aparelho recusou o evento HID.';
  if (/NetworkError|Access denied|Unable to open|transfer/i.test(message)) {
    return 'A porta USB está ocupada. Feche Arquivos, Quick Share, ADB e outras páginas WebUSB.';
  }
  return message || 'Falha desconhecida ao registrar o HID.';
}
