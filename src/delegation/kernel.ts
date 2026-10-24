import type {
  ActionReceipt, ActionRequest, AuditEvent, AuthorityPort, CapabilityLease,
  ExecutionPort, LeaseRequest, LocalCapability,
} from "./contracts";
import { DenyAllAuthority } from "./contracts";

const CAPABILITIES: ReadonlySet<string> = new Set([
  "local.note.append", "local.note.read", "local.math.sum",
]);
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const MAX_USES = 100;

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= 128 && /^[A-Za-z0-9_.:\/-]+$/.test(s);
}
function isCapability(v: string): v is LocalCapability { return CAPABILITIES.has(v); }

export class DelegationKernel {
  private readonly leases = new Map<string, CapabilityLease>();
  private readonly actions = new Map<string, { fingerprint: string; result: Promise<ActionReceipt> }>();
  private readonly audit: AuditEvent[] = [];

  constructor(
    private readonly executor: ExecutionPort,
    private readonly authority: AuthorityPort = new DenyAllAuthority(),
    private readonly nowMs: () => number = Date.now,
  ) {}

  private event(kind: AuditEvent["kind"], leaseId: string, reason: string, actionId?: string): void {
    this.audit.push({ sequence: this.audit.length + 1, kind, leaseId, actionId, timestampMs: this.nowMs(), reason });
  }

  getAudit(): AuditEvent[] { return this.audit.map((e) => ({ ...e })); }
  getLease(leaseId: string): CapabilityLease | undefined {
    const lease = this.leases.get(leaseId);
    return lease ? { ...lease } : undefined;
  }

  async issueLease(request: LeaseRequest, humanApproval: unknown): Promise<CapabilityLease> {
    const now = this.nowMs();
    if (!nonEmpty(request.leaseId) || !nonEmpty(request.agentId) || !nonEmpty(request.principalId) ||
        !nonEmpty(request.scope) || !isCapability(request.capability) ||
        !Number.isSafeInteger(request.maxUses) || request.maxUses < 1 || request.maxUses > MAX_USES ||
        !Number.isSafeInteger(request.expiresAtMs) || request.expiresAtMs <= now ||
        request.expiresAtMs > now + MAX_LEASE_MS || this.leases.has(request.leaseId)) {
      throw new Error("INVALID_LEASE");
    }
    // Evaluate authority at the outer boundary; never rely on an LLM-provided 'approved' field.
    if (!(await this.authority.approveLease({ ...request }, humanApproval))) {
      throw new Error("CONSENT_REQUIRED");
    }
    // Authority calls may be asynchronous. Validate again after return to block approval-time races.
    if (this.leases.has(request.leaseId) || this.nowMs() >= request.expiresAtMs) {
      throw new Error("LEASE_CONFLICT_OR_EXPIRED");
    }
    const lease: CapabilityLease = { ...request, issuedAtMs: this.nowMs(), uses: 0 };
    this.leases.set(request.leaseId, lease);
    this.event("LEASE_ISSUED", request.leaseId, "CONSENT_VALIDATED");
    return { ...lease };
  }

  async revokeLease(leaseId: string, humanApproval: unknown): Promise<void> {
    const lease = this.leases.get(leaseId);
    if (!lease) throw new Error("UNKNOWN_LEASE");
    if (!(await this.authority.approveRevocation({ ...lease }, humanApproval))) {
      throw new Error("REVOCATION_NOT_AUTHORIZED");
    }
    if (!lease.revokedAtMs) {
      lease.revokedAtMs = this.nowMs();
      this.event("LEASE_REVOKED", leaseId, "AUTHORIZED_REVOCATION");
    }
  }

  async execute(action: ActionRequest): Promise<ActionReceipt> {
    if (!nonEmpty(action.actionId)) throw new Error("INVALID_ACTION_ID");
    // Byte-level identity on the supplied serializable request: same ID + new payload is a conflict.
    const fingerprint = JSON.stringify(action);
    if (fingerprint === undefined) throw new Error("UNSERIALIZABLE_ACTION");
    const old = this.actions.get(action.actionId);
    if (old) {
      if (old.fingerprint !== fingerprint) throw new Error("ACTION_ID_CONFLICT");
      return old.result;
    }
    // Reserve the ID synchronously before awaiting the executor: concurrent duplicates are single-flight.
    const result = this.perform(action);
    this.actions.set(action.actionId, { fingerprint, result });
    return result;
  }

  private async perform(action: ActionRequest): Promise<ActionReceipt> {
    const timestampMs = this.nowMs();
    const deny = (reason: string): ActionReceipt => {
      this.event("ACTION_DENIED", action.leaseId, reason, action.actionId);
      return { actionId: action.actionId, leaseId: action.leaseId, agentId: action.agentId,
        status: "DENIED", timestampMs, reason };
    };
    const lease = this.leases.get(action.leaseId);
    if (!lease) return deny("LEASE_UNKNOWN");
    if (lease.revokedAtMs !== undefined) return deny("LEASE_REVOKED");
    if (timestampMs >= lease.expiresAtMs) return deny("LEASE_EXPIRED");
    if (lease.uses >= lease.maxUses) return deny("BUDGET_EXHAUSTED");
    if (action.agentId !== lease.agentId) return deny("AGENT_MISMATCH");
    if (action.capability !== lease.capability || !isCapability(action.capability)) return deny("CAPABILITY_MISMATCH");
    if (action.scope !== lease.scope) return deny("SCOPE_MISMATCH");
    // Reserve use even if executor fails. This prevents unlimited retries against side-effectful ports.
    lease.uses++;
    try {
      const result = await this.executor.execute({ ...action });
      this.event("ACTION_EXECUTED", action.leaseId, "LOCAL_EXECUTOR_OK", action.actionId);
      return { actionId: action.actionId, agentId: action.agentId, leaseId: action.leaseId,
        status: "EXECUTED", timestampMs, reason: "LOCAL_EXECUTOR_OK", result };
    } catch {
      this.event("ACTION_FAILED", action.leaseId, "EXECUTOR_ERROR", action.actionId);
      return { actionId: action.actionId, agentId: action.agentId, leaseId: action.leaseId,
        status: "FAILED", timestampMs, reason: "EXECUTOR_ERROR" };
    }
  }
}
