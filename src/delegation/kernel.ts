import type {
  ActionReceipt, ActionRequest, AuditEvent, AuthorityPort, CapabilityLease,
  ExecutionPort, IdentityBoundary, LeaseRequest, LocalCapability,
} from "./contracts";
import { DenyAllAuthority, DenyAllIdentity } from "./contracts";
import { canonicalSnapshot } from "./canonical";

const CAPABILITIES: ReadonlySet<string> = new Set(["local.note.append", "local.note.read", "local.math.sum"]);
const MAX_LEASE_MS = 86_400_000;
const MAX_USES = 100;
const MAX_LEASES = 1000;
const MAX_ACTIONS = 5000;
const MAX_AUDIT = 10000;
function validId(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= 128 && /^[A-Za-z0-9_.:/-]+$/.test(s);
}
function isCapability(v: unknown): v is LocalCapability { return typeof v === "string" && CAPABILITIES.has(v); }

/** Single-process reference, NOT durable/distributed. Auth/consent provider injection is a privileged boundary. */
export class DelegationKernel {
  private readonly leases = new Map<string, CapabilityLease>();
  private readonly actions = new Map<string, { fingerprint: string; result: Promise<ActionReceipt> }>();
  private readonly audit: AuditEvent[] = [];
  constructor(
    private readonly executor: ExecutionPort,
    private readonly authority: AuthorityPort = new DenyAllAuthority(),
    private readonly identities: IdentityBoundary = new DenyAllIdentity(),
    private readonly nowMs: () => number = Date.now,
  ) {}
  private event(kind: AuditEvent["kind"], leaseId: string, reason: string, actionId?: string): void {
    if (this.audit.length >= MAX_AUDIT) throw Error("AUDIT_CAPACITY_EXHAUSTED");
    this.audit.push({ sequence: this.audit.length + 1, kind, leaseId, actionId, timestampMs: this.nowMs(), reason });
  }
  getAudit(): AuditEvent[] { return this.audit.map(e => ({ ...e })); }
  getLease(id: string): CapabilityLease | undefined { const l = this.leases.get(id); return l ? { ...l } : undefined; }

  async issueLease(req: LeaseRequest, ownerProof: unknown, humanApproval: unknown): Promise<CapabilityLease> {
    const now = this.nowMs();
    if (!req || typeof req !== "object") throw Error("INVALID_LEASE");
    // Snapshot lease data before crossing the asynchronous trust boundary.
    req = Object.freeze({ leaseId: req.leaseId, principalId: req.principalId, agentId: req.agentId,
      scope: req.scope, capability: req.capability, expiresAtMs: req.expiresAtMs, maxUses: req.maxUses });
    if (!validId(req.leaseId) || !validId(req.principalId) || !validId(req.agentId) ||
      !validId(req.scope) || !isCapability(req.capability) ||
      !Number.isSafeInteger(req.expiresAtMs) || req.expiresAtMs <= now || req.expiresAtMs > now + MAX_LEASE_MS ||
      !Number.isSafeInteger(req.maxUses) || req.maxUses < 1 || req.maxUses > MAX_USES ||
      this.leases.has(req.leaseId) || this.leases.size >= MAX_LEASES) throw Error("INVALID_LEASE");
    const owner = await this.identities.authenticateOwner(ownerProof);
    if (!owner || !validId(owner.principalId) || owner.principalId !== req.principalId) throw Error("OWNER_AUTH_FAILED");
    if (!(await this.authority.approveLease({ ...req }, humanApproval))) throw Error("CONSENT_REQUIRED");
    if (this.leases.has(req.leaseId) || this.leases.size >= MAX_LEASES || this.nowMs() >= req.expiresAtMs) {
      throw Error("LEASE_CONFLICT_OR_EXPIRED");
    }
    // Event capacity is checked before committing lease; fail closed when audit is unavailable.
    if (this.audit.length >= MAX_AUDIT) throw Error("AUDIT_CAPACITY_EXHAUSTED");
    const lease: CapabilityLease = { ...req, issuedAtMs: this.nowMs(), uses: 0 };
    this.leases.set(req.leaseId, lease);
    this.event("LEASE_ISSUED", req.leaseId, "OWNER_AUTH_AND_CONSENT_VALIDATED");
    return { ...lease };
  }

  async revokeLease(leaseId: string, ownerProof: unknown, humanApproval: unknown): Promise<void> {
    const lease = this.leases.get(leaseId);
    if (!lease) throw Error("UNKNOWN_LEASE");
    const owner = await this.identities.authenticateOwner(ownerProof);
    if (!owner || owner.principalId !== lease.principalId) throw Error("OWNER_AUTH_FAILED");
    if (!(await this.authority.approveRevocation({ ...lease }, humanApproval))) throw Error("REVOCATION_NOT_AUTHORIZED");
    if (lease.revokedAtMs !== undefined) return;
    if (this.audit.length >= MAX_AUDIT) throw Error("AUDIT_CAPACITY_EXHAUSTED");
    lease.revokedAtMs = this.nowMs();
    this.event("LEASE_REVOKED", leaseId, "OWNER_REVOKED");
  }

  async execute(request: ActionRequest, agentProof: unknown): Promise<ActionReceipt> {
    if (!request || !validId(request.actionId) || !validId(request.leaseId) || !validId(request.agentId) ||
        !validId(request.scope) || !isCapability(request.capability)) throw Error("INVALID_ACTION");
    // Copy/validate input BEFORE any async boundary: the caller cannot mutate an authorized operation later.
    const clean = canonicalSnapshot(request.payload);
    const action: ActionRequest = Object.freeze({
      actionId: request.actionId, leaseId: request.leaseId, agentId: request.agentId,
      capability: request.capability, scope: request.scope, payload: clean.value,
    });
    const fingerprint = JSON.stringify([action.actionId, action.leaseId, action.agentId, action.capability, action.scope, clean.json]);
    // Authenticate EACH request before examining cached receipts. Duplicates may not bypass authentication.
    let actor;
    try { actor = await this.identities.authenticateAgent(agentProof); }
    catch { actor = null; }
    if (!actor || !validId(actor.agentId) || !validId(actor.principalId) || actor.agentId !== action.agentId) {
      throw Error("AGENT_AUTH_FAILED");
    }
    const lease = this.leases.get(action.leaseId);
    if (!lease || actor.principalId !== lease.principalId || actor.agentId !== lease.agentId) {
      throw Error("AGENT_PRINCIPAL_MISMATCH");
    }
    const old = this.actions.get(action.actionId);
    if (old) {
      if (old.fingerprint !== fingerprint) throw Error("ACTION_ID_CONFLICT");
      return old.result;
    }
    if (this.actions.size >= MAX_ACTIONS || this.audit.length >= MAX_AUDIT) throw Error("RESOURCE_LIMIT");
    const result = this.perform(action);
    this.actions.set(action.actionId, { fingerprint, result });
    return result;
  }
  private async perform(action: Readonly<ActionRequest>): Promise<ActionReceipt> {
    const timestampMs = this.nowMs();
    const deny = (reason: string): ActionReceipt => {
      this.event("ACTION_DENIED", action.leaseId, reason, action.actionId);
      return { actionId: action.actionId, leaseId: action.leaseId, agentId: action.agentId, status: "DENIED", timestampMs, reason };
    };
    const lease = this.leases.get(action.leaseId);
    if (!lease) return deny("LEASE_UNKNOWN");
    if (lease.revokedAtMs !== undefined) return deny("LEASE_REVOKED");
    if (this.nowMs() >= lease.expiresAtMs) return deny("LEASE_EXPIRED");
    if (lease.uses >= lease.maxUses) return deny("BUDGET_EXHAUSTED");
    if (action.capability !== lease.capability) return deny("CAPABILITY_MISMATCH");
    if (action.scope !== lease.scope) return deny("SCOPE_MISMATCH");
    // Use is reserved synchronously after async authentication. No await before increment.
    lease.uses++;
    try {
      const result = await this.executor.execute(action);
      const revokedDuringExecution = lease.revokedAtMs !== undefined;
      const reason = revokedDuringExecution ? "COMPLETED_AFTER_REVOCATION" : "LOCAL_EXECUTOR_OK";
      this.event(revokedDuringExecution ? "ACTION_COMPLETED_AFTER_REVOCATION" : "ACTION_EXECUTED", action.leaseId, reason, action.actionId);
      return { actionId: action.actionId, leaseId: action.leaseId, agentId: action.agentId,
        status: "EXECUTED", timestampMs, reason, result: canonicalSnapshot(result).value };
    } catch {
      this.event("ACTION_FAILED", action.leaseId, "EXECUTOR_ERROR", action.actionId);
      return { actionId: action.actionId, leaseId: action.leaseId, agentId: action.agentId,
        status: "FAILED", timestampMs, reason: "EXECUTOR_ERROR" };
    }
  }
}
