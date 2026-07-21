import { describe, expect, it } from 'vitest';

import {
  applyRescueProof,
  createRescueSnapshot,
  createSafeDiagnostic,
} from '../stateMachine';
import type { RescueProof } from '../types';

const AT = '2026-07-21T12:00:00.000Z';
const clock = () => AT;

type RescueProofInput = RescueProof extends infer Candidate
  ? Candidate extends RescueProof
    ? Omit<Candidate, 'recordedAt'>
    : never
  : never;

function proof(value: RescueProofInput): RescueProof {
  return { ...value, recordedAt: AT } as RescueProof;
}

function usbProof(): RescueProof {
  return proof({
    kind: 'usb_detected',
    source: 'webusb',
    vendorId: 0x04e8,
    productId: 0x6860,
    productName: 'Samsung Android',
  });
}

describe('Rescue state machine', () => {
  it('advances only when the required proofs arrive', () => {
    let snapshot = createRescueSnapshot(clock);
    snapshot = applyRescueProof(snapshot, usbProof(), clock);
    expect(snapshot.state).toBe('USB_DETECTED');

    snapshot = applyRescueProof(
      snapshot,
      proof({ kind: 'aoa_protocol', source: 'webusb', protocol: 2 }),
      clock,
    );
    expect(snapshot.state).toBe('AOA_SUPPORTED');
    expect(snapshot.events.map((event) => event.to)).toEqual([
      'USB_DETECTED',
      'AOA_PROBED',
      'AOA_SUPPORTED',
    ]);

    snapshot = applyRescueProof(
      snapshot,
      proof({
        kind: 'hid_registration',
        source: 'webusb',
        keyboardId: 1,
        mouseId: 2,
      }),
      clock,
    );
    expect(snapshot.state).toBe('HID_READY');

    snapshot = applyRescueProof(
      snapshot,
      proof({
        kind: 'adb_status',
        source: 'adb',
        serial: 'R58MEXAMPLE',
        status: 'unauthorized',
      }),
      clock,
    );
    expect(snapshot.state).toBe('ADB_UNAUTHORIZED');

    snapshot = applyRescueProof(
      snapshot,
      proof({
        kind: 'adb_status',
        source: 'adb',
        serial: 'R58MEXAMPLE',
        status: 'device',
      }),
      clock,
    );
    expect(snapshot.state).toBe('ADB_AUTHORIZED');
  });

  it('rejects an unsupported AOA device before HID_READY', () => {
    let snapshot = createRescueSnapshot(clock);
    snapshot = applyRescueProof(snapshot, usbProof(), clock);
    snapshot = applyRescueProof(
      snapshot,
      proof({ kind: 'aoa_protocol', source: 'webusb', protocol: 1 }),
      clock,
    );
    expect(snapshot.state).toBe('AOA_UNAVAILABLE');

    expect(() =>
      applyRescueProof(
        snapshot,
        proof({
          kind: 'hid_registration',
          source: 'webusb',
          keyboardId: 1,
          mouseId: 2,
        }),
        clock,
      ),
    ).toThrow('INVALID_TRANSITION');
  });

  it('does not allow ADB_AUTHORIZED without a prior physical connection', () => {
    const snapshot = createRescueSnapshot(clock);
    expect(() =>
      applyRescueProof(
        snapshot,
        proof({
          kind: 'adb_status',
          source: 'adb',
          serial: 'R58MEXAMPLE',
          status: 'device',
        }),
        clock,
      ),
    ).toThrow('INVALID_TRANSITION:DISCONNECTED->ADB_AUTHORIZED');
  });

  it('redacts the ADB serial and acquisition destination from diagnostics', () => {
    let snapshot = createRescueSnapshot(clock);
    snapshot = applyRescueProof(snapshot, usbProof(), clock);
    snapshot = applyRescueProof(
      snapshot,
      proof({
        kind: 'adb_status',
        source: 'adb',
        serial: 'R58MSECRET',
        status: 'device',
      }),
      clock,
    );
    snapshot = applyRescueProof(
      snapshot,
      proof({
        kind: 'acquisition_started',
        source: 'acquisition',
        destinationLabel: '/home/user/private-backup',
        requestedPaths: ['/sdcard/DCIM'],
      }),
      clock,
    );

    const diagnostic = createSafeDiagnostic(snapshot, {
      platform: 'ChromeOS',
      secureContext: true,
      topLevel: true,
      webUsb: true,
    });
    expect(diagnostic).not.toContain('R58MSECRET');
    expect(diagnostic).not.toContain('/home/user/private-backup');
    expect(diagnostic).toContain('"secretsIncluded": false');
  });

  it('does not verify an acquisition without copied files', () => {
    let snapshot = createRescueSnapshot(clock);
    snapshot = applyRescueProof(snapshot, usbProof(), clock);
    snapshot = applyRescueProof(
      snapshot,
      proof({
        kind: 'adb_status',
        source: 'adb',
        serial: 'R58MEXAMPLE',
        status: 'device',
      }),
      clock,
    );
    snapshot = applyRescueProof(
      snapshot,
      proof({
        kind: 'acquisition_started',
        source: 'acquisition',
        destinationLabel: '/local/backup',
        requestedPaths: ['/sdcard/DCIM'],
      }),
      clock,
    );

    expect(() =>
      applyRescueProof(
        snapshot,
        proof({
          kind: 'acquisition_manifest',
          source: 'acquisition',
          manifestSha256: 'a'.repeat(64),
          fileCount: 0,
          totalBytes: 0,
          failedPaths: ['/sdcard/DCIM'],
        }),
        clock,
      ),
    ).toThrow('INVALID_PROOF:fileCount');
  });
});
