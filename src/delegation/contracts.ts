/** Symbiodroid governed delegation contracts — v0.2 experimental. */
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
export interface AuthenticatedPrincipal { principalId: string; }
export interface AuthenticatedAgent { principalId: string; agentId: string; }
/** Trusted device/session adapter. Never use a caller supplied ID as the authentication result. */
export interface IdentityBoundary {
  authenticateOwner(proof: unknown): Promise<AuthenticatedPrincipal | null>;
  authenticateAgent(proof: unknown): Promise<AuthenticatedAgent | null>;
}
export interface AuthorityPort {
  approveLease(request: Readonly<LeaseRequest>, humanApproval: unknown): Promise<boolean>;
  approveRevocation(lease: Readonly<CapabilityLease>, humanApproval: unknown): Promise<boolean>;
}
export interface ExecutionPort { execute(action: Readonly<ActionRequest>): Promise<unknown>; }
export interface ActionReceipt {
  actionId: string; agentId: string; leaseId: string;
  status: ActionStatus; timestampMs: number; reason: string; result?: unknown;
}
export interface AuditEvent {
  sequence: number;
  kind: "LEASE_ISSUED" | "LEASE_REVOKED" | "ACTION_EXECUTED" | "ACTION_DENIED" | "ACTION_FAILED" | "ACTION_COMPLETED_AFTER_REVOCATION";
  leaseId: string; actionId?: string; timestampMs: number; reason: string;
}
/** Fail-closed production defaults. These are not real biometric/cryptographic implementations. */
export class DenyAllAuthority implements AuthorityPort {
  async approveLease(): Promise<boolean> { return false; }
  async approveRevocation(): Promise<boolean> { return false; }
}
export class DenyAllIdentity implements IdentityBoundary {
  async authenticateOwner(): Promise<null> { return null; }
  async authenticateAgent(): Promise<null> { return null; }
}
