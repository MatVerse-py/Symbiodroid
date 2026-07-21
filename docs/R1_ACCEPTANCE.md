# R1 Acceptance: Broken Screen Continuity

Automated checks prove software invariants. They do not prove that a specific Samsung firmware
accepts AOA HID while locked. R1 is accepted only after both gates below pass.

## Automated gate

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

Required invariants:

- impossible state transitions are rejected;
- AOA below version 2 cannot reach `HID_READY`;
- `ADB_AUTHORIZED` requires an ADB proof with status `device`;
- invalid or duplicate manifest entries are rejected;
- diagnostic output does not expose serials or local destinations;
- no destructive Rescue command is introduced.

## Physical gate

Use an owned Samsung A13 `SM-A135M/DS` or another explicitly authorized Android device.

1. Chrome lists the physical Samsung from one user gesture.
2. WebUSB records vendor/product identifiers.
3. AOA protocol response is recorded.
4. Keyboard and mouse HID descriptors register successfully.
5. A non-secret test key changes the physical device state.
6. The owner enters the PIN locally; no input appears in logs.
7. `adb devices -l` changes from `unauthorized` to `device` after the owner accepts RSA.
8. Initial shared-storage acquisition completes.
9. `sha256sum -c MANIFEST.sha256` passes.
10. `sha256sum -c SHA256SUMS.txt` passes.
11. A first valid mirror frame is decoded and hashed.

Record only sanitized diagnostics in the PR. Keep device serials and acquired files local.

## Release decision

- Automated gate only: mergeable foundation, hardware status **UNVERIFIED**.
- Automated and physical gates: R1 **PHYSICALLY VERIFIED** for the recorded model/firmware.
- AOA/HID rejected while locked: document the firmware result and report
  `FAILED_REQUIRES_HARDWARE_REPAIR`; do not weaken security controls.
