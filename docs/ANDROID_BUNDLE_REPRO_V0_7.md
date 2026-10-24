# Symbiodroid v0.7 — Build reproducibility and Android JS export

## Verified blocker
Source snapshot preceding v0.7 (2026-10-24): `package.json` declares 137 dependencies (including dev dependencies); `pnpm-lock.yaml` root importer lists **46**. Comparison by exact name and declared semver specifier yields **91 missing** and **18 mismatched** records. Not having `package-lock.json` is expected: the repo uses pnpm.

A successful isolated TypeScript test suite (94/94 on PR #9) does **not** show that the full Expo project has resolvable, reproducible dependencies, a bundle or an APK.

## New restricted GitHub Actions flow
Workflow: `.github/workflows/android-bundle-readiness.yml`

- Same-repository branch **`feat/android-bundle-repro-v0-7` only** (draft PR). No PRs from forks and no run on main.
- Pin Node 22 and pnpm 9.15.9 (lockfileVersion 9).
- Run 6 standalone manifest/lockfile parser tests, report baseline drift, regenerate lockfile from the existing `package.json` using `--lockfile-only --ignore-scripts`.
- Demand exact importer consistency and a **frozen** pnpm install with package scripts disabled.
- Commit and push **only `pnpm-lock.yaml`** back to the same review branch if reconciliation succeeds. A non-fast-forward push fails instead of overwriting concurrent work.
- Export Android JavaScript and assets via **Expo Metro** with `pnpm exec expo export --platform android`.

The generated JS bundle is **NOT** an Android APK and proves neither native compilation nor runtime functionality. No external agent side effects, payment/messaging, credential issuance or Ω control changes.

## Security and review constraints
- The workflow has narrowly scoped write permission to update the draft branch's lockfile after checks. Review all resulting dependency resolution changes before merging.
- Regeneration can fail due to package availability, incompatible peer constraints or registry configuration. A red CI is a valid HOLD finding, not success.
- Installing with `--ignore-scripts` deliberately avoids package execution in dependency resolution, but also means native module postinstall/build behavior is **not** validated.
- Metro JS export is a higher confidence signal than TSX syntax parsing, not an APK or physical-device test.
- No secrets should be embedded into `EXPO_PUBLIC_*` variables or generated JS.
- Underlying old app UI may still make unverified governance claims; native identity binding, Ω-Gate, encryption and executor remain HOLD (#4/#5).
- Real signed Android build requires separate release/development build credentials, android tooling or a trusted EAS Build workflow and a device installation smoke test.

## Acceptance evidence
1. Lockfile importer audit PASS after regeneration.
2. Frozen dependency install PASS.
3. Android Metro export PASS (if it runs; inspect job logs).
4. Review lockfile diff in draft PR, retaining license/security and compatibility checks.
5. Only afterwards assess Android development APK and owned-device test.

**Do not mark ANDROID_RUNTIME_PASS or WORLD_REAL_PASS based on this workflow.**
