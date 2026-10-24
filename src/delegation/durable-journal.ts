/**
 * Symbiodroid v0.3: privileged SQLite reservation journal.
 * UNKNOWN is durable BEFORE effect dispatch; automatic retry is forbidden.
 * NOT an identity verifier or a second Omega-Gate; do not call directly from untrusted UI.
 */
import type { ActionRequest, CapabilityLease } from './contracts';
import { canonicalSnapshot } from './canonical';
export type SqlValue = string | number | null;
export interface SqlTx {
  run(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  get<T extends object>(sql: string, ...params: SqlValue[]): Promise<T | null>;
}
export interface SqlPort {
  execute(sql: string): Promise<void>;
  transaction<T>(body: (tx: SqlTx) => Promise<T>): Promise<T>;
}
export type JournalState = 'UNKNOWN' | 'EXECUTED' | 'FAILED';
export type ReserveResult =
  | { verdict: 'RESERVED'; actionId: string; status: 'UNKNOWN' }
  | { verdict: 'HOLD'; reason: string; actionId: string; status?: JournalState }
  | { verdict: 'DENIED'; reason: string; actionId: string }
  | { verdict: 'REPLAY'; actionId: string; status: 'EXECUTED' | 'FAILED' };
interface LeaseRow {
  lease_id: string; principal_id: string; agent_id: string; capability: string; scope: string;
  expires_ms: number; issued_ms: number; max_uses: number; uses: number; revoked_ms: number | null;
}
interface ActionRow {
  action_id: string; lease_id: string; principal_id: string; agent_id: string;
  fingerprint: string; status: JournalState;
}
const ID = /^[A-Za-z0-9_.:/-]{1,128}$/;
const validId = (x: unknown): x is string => typeof x === 'string' && ID.test(x);
export class DurableDelegationJournal {
  constructor(private readonly db: SqlPort, private readonly nowMs: () => number = Date.now) {}
  async initialize(): Promise<void> {
    await this.db.execute('PRAGMA foreign_keys=ON');
    await this.db.execute(`CREATE TABLE IF NOT EXISTS delegation_leases (
      lease_id TEXT PRIMARY KEY, principal_id TEXT NOT NULL, agent_id TEXT NOT NULL,
      capability TEXT NOT NULL, scope TEXT NOT NULL, expires_ms INTEGER NOT NULL,
      issued_ms INTEGER NOT NULL, max_uses INTEGER NOT NULL CHECK(max_uses >= 1),
      uses INTEGER NOT NULL DEFAULT 0, revoked_ms INTEGER
    );
    CREATE TABLE IF NOT EXISTS delegation_actions (
      action_id TEXT PRIMARY KEY,
      lease_id TEXT NOT NULL REFERENCES delegation_leases(lease_id),
      principal_id TEXT NOT NULL, agent_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(status IN ('UNKNOWN','EXECUTED','FAILED')),
      reserved_ms INTEGER NOT NULL, completed_ms INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_delegation_action_lease ON delegation_actions(lease_id);`);
  }
  /** Grant only AFTER authenticating the owner and verifying consent in a trusted component. */
  async grant(lease: Readonly<CapabilityLease>): Promise<void> {
    if (!validId(lease.leaseId) || !validId(lease.principalId) || !validId(lease.agentId) ||
        !validId(lease.scope) || !['local.note.append','local.note.read','local.math.sum'].includes(lease.capability) ||
        !Number.isSafeInteger(lease.issuedAtMs) || !Number.isSafeInteger(lease.expiresAtMs) ||
        lease.expiresAtMs <= this.nowMs() || lease.expiresAtMs <= lease.issuedAtMs ||
        lease.expiresAtMs - lease.issuedAtMs > 86_400_000 || lease.uses !== 0 ||
        !Number.isSafeInteger(lease.maxUses) || lease.maxUses < 1 || lease.maxUses > 100 ||
        lease.revokedAtMs !== undefined) throw Error('INVALID_LEASE');
    await this.db.transaction(async tx => {
      const r = await tx.run(`INSERT OR IGNORE INTO delegation_leases
        (lease_id,principal_id,agent_id,capability,scope,expires_ms,issued_ms,max_uses,uses,revoked_ms)
        VALUES (?,?,?,?,?,?,?,?,0,NULL)`,
        lease.leaseId,lease.principalId,lease.agentId,lease.capability,lease.scope,
        lease.expiresAtMs,lease.issuedAtMs,lease.maxUses);
      if (r.changes !== 1) throw Error('LEASE_DUPLICATE');
    });
  }
  async getLeaseForOwner(leaseId: string, principalId: string): Promise<CapabilityLease | null> {
    if (!validId(leaseId) || !validId(principalId)) throw Error('INVALID_OWNER_QUERY');
    return this.db.transaction(async tx => {
      const row = await tx.get<LeaseRow>(
        'SELECT * FROM delegation_leases WHERE lease_id=? AND principal_id=?',leaseId,principalId);
      if (!row) return null;
      return {leaseId:row.lease_id,principalId:row.principal_id,agentId:row.agent_id,
        capability:row.capability as CapabilityLease['capability'],scope:row.scope,
        issuedAtMs:row.issued_ms,expiresAtMs:row.expires_ms,maxUses:row.max_uses,uses:row.uses,
        ...(row.revoked_ms === null ? {} : {revokedAtMs:row.revoked_ms})};
    });
  }
  /** Re-checks owner identity atomically, even if caller previously checked it. */
  async revokeForOwner(leaseId: string, principalId: string): Promise<void> {
    if (!validId(leaseId) || !validId(principalId)) throw Error('INVALID_LEASE_OR_OWNER');
    await this.db.transaction(async tx => {
      const row = await tx.get<{lease_id:string}>(
        'SELECT lease_id FROM delegation_leases WHERE lease_id=? AND principal_id=?',leaseId,principalId);
      if (!row) throw Error('LEASE_NOT_OWNED');
      await tx.run('UPDATE delegation_leases SET revoked_ms=? WHERE lease_id=? AND principal_id=? AND revoked_ms IS NULL',
        this.nowMs(),leaseId,principalId);
    });
  }
  /** Each invocation must already have passed IdentityBoundary and OmegaDecisionPort. */
  async reserve(action: Readonly<ActionRequest>, principalId: string, fingerprint: string): Promise<ReserveResult> {
    if (!action || !validId(action.actionId) || !validId(action.leaseId) ||
        !validId(action.agentId) || !validId(action.scope) || !validId(principalId) ||
        !['local.note.append','local.note.read','local.math.sum'].includes(action.capability) ||
        !/^[a-f0-9]{64}$/.test(fingerprint)) throw Error('INVALID_RESERVATION');
    canonicalSnapshot(action.payload);
    return this.db.transaction(async tx => {
      const old = await tx.get<ActionRow>(
        'SELECT action_id,lease_id,principal_id,agent_id,fingerprint,status FROM delegation_actions WHERE action_id=?',action.actionId);
      if (old) {
        if (old.principal_id !== principalId || old.agent_id !== action.agentId || old.lease_id !== action.leaseId)
          return {verdict:'DENIED',reason:'IDENTITY_MISMATCH',actionId:action.actionId};
        if (old.fingerprint !== fingerprint) throw Error('ACTION_ID_CONFLICT');
        if (old.status === 'UNKNOWN') return {verdict:'HOLD',reason:'OUTCOME_UNKNOWN',actionId:action.actionId,status:old.status};
        return {verdict:'REPLAY',actionId:action.actionId,status:old.status};
      }
      const lease = await tx.get<LeaseRow>('SELECT * FROM delegation_leases WHERE lease_id=?',action.leaseId);
      const denied = (reason: string): ReserveResult => ({verdict:'DENIED',reason,actionId:action.actionId});
      if (!lease) return denied('LEASE_UNKNOWN');
      if (lease.principal_id !== principalId || lease.agent_id !== action.agentId) return denied('IDENTITY_MISMATCH');
      if (lease.capability !== action.capability || lease.scope !== action.scope) return denied('CAPABILITY_OR_SCOPE_MISMATCH');
      if (lease.revoked_ms !== null) return denied('LEASE_REVOKED');
      if (this.nowMs() >= lease.expires_ms) return denied('LEASE_EXPIRED');
      if (lease.uses >= lease.max_uses) return denied('BUDGET_EXHAUSTED');
      const change = await tx.run(`UPDATE delegation_leases SET uses=uses+1 WHERE lease_id=?
        AND revoked_ms IS NULL AND uses < max_uses AND expires_ms > ?`,action.leaseId,this.nowMs());
      if (change.changes !== 1) return denied('CONCURRENT_CONFLICT');
      await tx.run(`INSERT INTO delegation_actions
        (action_id,lease_id,principal_id,agent_id,fingerprint,status,reserved_ms)
        VALUES (?,?,?,?,?,'UNKNOWN',?)`,
        action.actionId,action.leaseId,principalId,action.agentId,fingerprint,this.nowMs());
      return {verdict:'RESERVED',actionId:action.actionId,status:'UNKNOWN'};
    });
  }
  /** Only trusted EvidenceOS / executor reconciliation may promote UNKNOWN. */
  async reconcile(actionId: string, fingerprint: string, outcome: 'EXECUTED' | 'FAILED'): Promise<void> {
    if (!validId(actionId) || !/^[a-f0-9]{64}$/.test(fingerprint) ||
      (outcome !== 'EXECUTED' && outcome !== 'FAILED')) throw Error('INVALID_RECONCILIATION');
    await this.db.transaction(async tx => {
      const row = await tx.get<ActionRow>(
        'SELECT action_id,lease_id,principal_id,agent_id,fingerprint,status FROM delegation_actions WHERE action_id=?',actionId);
      if (!row || row.fingerprint !== fingerprint) throw Error('RECONCILIATION_MISMATCH');
      if (row.status !== 'UNKNOWN') {
        if (row.status !== outcome) throw Error('CONFLICTING_EVIDENCE');
        return;
      }
      await tx.run("UPDATE delegation_actions SET status=?,completed_ms=? WHERE action_id=? AND status='UNKNOWN'",
        outcome,this.nowMs(),actionId);
    });
  }
  async inspect(actionId: string): Promise<JournalState | null> {
    if (!validId(actionId)) throw Error('INVALID_ACTION_ID');
    return this.db.transaction(async tx => {
      const row = await tx.get<{status:JournalState}>(
        'SELECT status FROM delegation_actions WHERE action_id=?',actionId);
      return row?.status ?? null;
    });
  }
}
