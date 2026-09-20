# Rescue Security Model

## Authorization model

Symbiodroid Rescue operates only on a physically connected device controlled by its owner. It does
not bypass Android authentication. The owner supplies the existing PIN locally and explicitly
accepts the ADB RSA key on the device.

## Fail-closed rules

The Rescue mode prohibits:

- factory reset;
- firmware flashing;
- bootloader unlocking;
- root or exploit chains;
- partition writes;
- lock-screen bypass;
- silent app installation;
- deletion or mutation of target data;
- logging credentials, PIN digits, OTPs or ADB private keys.

A failed control transfer is a failed operation. It must not be converted into a successful state.

## Secret handling

- PIN input is sent directly as HID reports and never appended to React state, analytics or logs.
- Diagnostics redact ADB serials and local destination labels.
- Acquisition artifacts stay on the local host unless the user separately authorizes a transfer.
- Server secrets must never be bundled into Expo or web builds.
- The Rescue host has no default remote API dependency.

## Evidence claims

UI demos, random data, placeholder fingerprints and mocked processing are not evidence. Any screen
that uses simulated forensic data must be visibly labeled **SIMULATION — NO FORENSIC VALIDITY**.
Only cryptographic hashes calculated from acquired bytes may be described as SHA-256 evidence.

## Reporting vulnerabilities

Do not attach real PINs, tokens, ADB keys, bank data or unredacted forensic artifacts to public
GitHub issues. Provide only the sanitized Rescue diagnostic and a minimal reproduction.
