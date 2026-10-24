/** MatVerse/Symbiodroid — identity and authorization contracts. */
export type LocalCapability = "local.note.append" | "local.note.read" | "local.math.sum";
export type ActionStatus = "EXECUTED" | "DENIED" | "FAILED";

export interface LeaseRequest {
  leaseId: string;
  principalId: string;
  agentId: string;
  capability: LocalCapability;
  scope: string;
  expiresAtMs: number;
  maxUses: number;
}

export interface CapabilityLease extends LeaseRequest {
  issuedAtMs: number;
  uses: number;
  revokedAtMs?: number;
}

export interface ActionRequest {
  actionId: string;
  leaseId: string;
  agentId: string;
  capability: LocalCapability;
  scope: string;
  payload: unknown;
}

/** AuthorityPort is a TRUST BOUNDARY; a model cannot authorize itself. */
export interface AuthorityPort {
  approveLease(request: Readonly<LeaseRequest>, humanApproval: unknown): Promise<boolean>;
  approveRevocation(lease: Readonly<CapabilityLease>, humanApproval: unknown): Promise<boolean>;
}

export interface ExecutionPort {
  execute(action: Readonly<ActionRequest>): Promise<unknown>;
}

export interface ActionReceipt {
  actionId: string;
  agentId: string;
  leaseId: string;
  status: ActionStatus;
  timestampMs: number;
  reason: string;
  result?: unknown;
}

export interface AuditEvent {
  sequence: number;
  kind: "LEASE_ISSUED" | "LEASE_REVOKED" | "ACTION_EXECUTED" | "ACTION_DENIED" | "ACTION_FAILED";
  leaseId: string;
  actionId?: string;
  timestampMs: number;
  reason: string;
}

/** Production default. Real consent verification is intentionally NOT stubbed as allow. */
export class DenyAllAuthority implements AuthorityPort {
  async approveLease(): Promise<boolean> { return false; }
  async approveRevocation(): Promise<boolean> { return false; }
}
