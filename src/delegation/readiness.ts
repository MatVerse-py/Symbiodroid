/**
 * Read-only operational projection for an owned device, deliberately without payloads
 * or principal/agent identifiers. Must not be treated as an authorization API.
 */
import type { SqlPort } from "./durable-journal";

export const DELEGATION_DATABASE_NAME = "matverse-delegation-v0-4.db";

export interface DelegationReadiness {
  schema: "matverse.delegation.readiness.v1";
  inspectedAtMs: number;
  leases: { total: number; active: number; expired: number; revoked: number };
  actions: { total: number; unknown: number; executed: number; failed: number; dispatchClaimed: number };
  gates: {
    authenticatedDeviceIdentity: false;
    canonicalOmegaBound: false;
    externalExecutorEnabled: false;
    encryptionIndependentlyVerified: false;
    worldRealPass: false;
  };
}

type LeaseCounts = {
  total: number | null; active: number | null; expired: number | null; revoked: number | null;
};
type ActionCounts = {
  total: number | null; unknown: number | null; executed: number | null;
  failed: number | null; claimed: number | null;
};
function nonnegative(v: number | null | undefined): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw Error("INVALID_PROJECTION_COUNT");
  return v;
}

/**
 * Caller must initialize the journal/schema first; projection itself uses SELECT only.
 * These gates reflect independently unverified real-device integration, not live authorization.
 */
export async function readDelegationReadiness(
  database: SqlPort, nowMs: () => number = Date.now,
): Promise<DelegationReadiness> {
  const timestamp = nowMs();
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw Error("INVALID_TIMESTAMP");
  return database.transaction(async tx => {
    const lease = await tx.get<LeaseCounts>(
      `SELECT COUNT(*) AS total,
      SUM(CASE WHEN revoked_ms IS NULL AND expires_ms > ? THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN revoked_ms IS NULL AND expires_ms <= ? THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN revoked_ms IS NOT NULL THEN 1 ELSE 0 END) AS revoked
      FROM delegation_leases`,
      timestamp, timestamp,
    );
    const action = await tx.get<ActionCounts>(
      `SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='UNKNOWN' THEN 1 ELSE 0 END) AS unknown,
      SUM(CASE WHEN status='EXECUTED' THEN 1 ELSE 0 END) AS executed,
      SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN dispatch_started_ms IS NOT NULL THEN 1 ELSE 0 END) AS claimed
      FROM delegation_actions`,
    );
    return {
      schema: "matverse.delegation.readiness.v1",
      inspectedAtMs: timestamp,
      leases: {
        total: nonnegative(lease?.total), active: nonnegative(lease?.active),
        expired: nonnegative(lease?.expired), revoked: nonnegative(lease?.revoked),
      },
      actions: {
        total: nonnegative(action?.total), unknown: nonnegative(action?.unknown),
        executed: nonnegative(action?.executed), failed: nonnegative(action?.failed),
        dispatchClaimed: nonnegative(action?.claimed),
      },
      gates: {
        authenticatedDeviceIdentity: false,
        canonicalOmegaBound: false,
        externalExecutorEnabled: false,
        encryptionIndependentlyVerified: false,
        worldRealPass: false,
      },
    };
  });
}
