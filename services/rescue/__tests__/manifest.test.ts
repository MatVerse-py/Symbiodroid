import { describe, expect, it } from 'vitest';

import { createAcquisitionManifest, serializeAcquisitionManifest } from '../manifest';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

describe('Acquisition manifest', () => {
  it('sorts files and calculates exact totals', () => {
    const manifest = createAcquisitionManifest({
      device: {
        serial: 'R58MEXAMPLE',
        model: 'SM-A135M',
        androidVersion: '14',
      },
      startedAt: '2026-07-21T12:00:00.000Z',
      completedAt: '2026-07-21T12:01:00.000Z',
      requestedPaths: ['/sdcard/DCIM'],
      copiedPaths: ['/sdcard/DCIM'],
      failedPaths: [],
      files: [
        { relativePath: 'DCIM/z.jpg', bytes: 11, sha256: HASH_B },
        { relativePath: 'DCIM/a.jpg', bytes: 7, sha256: HASH_A },
      ],
    });

    expect(manifest.files.map((file) => file.relativePath)).toEqual([
      'DCIM/a.jpg',
      'DCIM/z.jpg',
    ]);
    expect(manifest.totals).toEqual({ files: 2, bytes: 18 });
    expect(manifest.destructiveActions).toBe(0);
    expect(serializeAcquisitionManifest(manifest)).toMatch(/\n$/);
  });

  it('rejects path traversal and non-SHA-256 values', () => {
    const base = {
      device: { serial: 'R58MEXAMPLE', model: 'SM-A135M', androidVersion: '14' },
      startedAt: '2026-07-21T12:00:00.000Z',
      completedAt: '2026-07-21T12:01:00.000Z',
      requestedPaths: ['/sdcard/DCIM'],
      copiedPaths: ['/sdcard/DCIM'],
      failedPaths: [],
    };

    expect(() =>
      createAcquisitionManifest({
        ...base,
        files: [{ relativePath: '../outside', bytes: 1, sha256: HASH_A }],
      }),
    ).toThrow('INVALID_MANIFEST:relativePath');

    expect(() =>
      createAcquisitionManifest({
        ...base,
        files: [{ relativePath: 'DCIM/a.jpg', bytes: 1, sha256: 'not-a-hash' }],
      }),
    ).toThrow('INVALID_MANIFEST:sha256');
  });

  it('rejects duplicate file paths', () => {
    expect(() =>
      createAcquisitionManifest({
        device: { serial: 'R58MEXAMPLE', model: 'SM-A135M', androidVersion: '14' },
        startedAt: '2026-07-21T12:00:00.000Z',
        completedAt: '2026-07-21T12:01:00.000Z',
        requestedPaths: ['/sdcard/DCIM'],
        copiedPaths: ['/sdcard/DCIM'],
        failedPaths: [],
        files: [
          { relativePath: 'DCIM/a.jpg', bytes: 1, sha256: HASH_A },
          { relativePath: 'DCIM/a.jpg', bytes: 1, sha256: HASH_B },
        ],
      }),
    ).toThrow('INVALID_MANIFEST:duplicatePath');
  });
});


describe('Acquisition manifest timestamp contract', () => {
  const base = {
    device: { serial: 'R58MEXAMPLE', model: 'SM-A135M', androidVersion: '14' },
    requestedPaths: ['/sdcard/DCIM'],
    copiedPaths: ['/sdcard/DCIM'],
    failedPaths: [],
    files: [{ relativePath: 'DCIM/a.jpg', bytes: 1, sha256: HASH_A }],
  };

  it('rejects parseable non-ISO timestamps', () => {
    expect(() =>
      createAcquisitionManifest({
        ...base,
        startedAt: 'Sep 20 2026',
        completedAt: '2026-09-20T12:01:00.000Z',
      }),
    ).toThrow('INVALID_MANIFEST:startedAt');
  });

  it('rejects normalized invalid calendar dates', () => {
    expect(() =>
      createAcquisitionManifest({
        ...base,
        startedAt: '2026-02-30T12:00:00.000Z',
        completedAt: '2026-03-02T12:01:00.000Z',
      }),
    ).toThrow('INVALID_MANIFEST:startedAt');
  });

  it('accepts canonical UTC timestamps with or without milliseconds', () => {
    expect(
      createAcquisitionManifest({
        ...base,
        startedAt: '2026-09-20T12:00:00Z',
        completedAt: '2026-09-20T12:01:00.000Z',
      }).startedAt,
    ).toBe('2026-09-20T12:00:00Z');
  });
});
