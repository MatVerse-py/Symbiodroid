/** Governed reservation facade, not a replacement for Ω-Gate. No execution side effects here. */
import type { ActionRequest, AuthorityPort, CapabilityLease, IdentityBoundary, LeaseRequest } from './contracts';
import { DenyAllAuthority, DenyAllIdentity } from './contracts';
import { canonicalSnapshot } from './canonical';
import { DurableDelegationJournal } from './durable-journal';
import type { ReserveResult } from './durable-journal';

export interface OmegaDecisionPort {
  allow(action: Readonly<ActionRequest>, authenticated: Readonly<{principalId:string;agentId:string}>): Promise<boolean>;
}
export class DenyAllOmegaDecision implements OmegaDecisionPort {
  async allow(): Promise<boolean> { return false; }
}
export interface FingerprintPort { sha256(text:string):Promise<string>; }
export interface EvidenceVerifier {
  verifyOutcome(actionId:string,fingerprint:string,outcome:'EXECUTED'|'FAILED',proof:unknown):Promise<boolean>;
}
export class DenyAllEvidenceVerifier implements EvidenceVerifier {
  async verifyOutcome():Promise<boolean> { return false; }
}
const valid=(x:unknown):x is string=>typeof x==='string' && /^[A-Za-z0-9_.:/-]{1,128}$/.test(x);
export class GuardedDelegationJournal {
  constructor(
    private readonly journal:DurableDelegationJournal,
    private readonly identity:IdentityBoundary=new DenyAllIdentity(),
    private readonly consent:AuthorityPort=new DenyAllAuthority(),
    private readonly omega:OmegaDecisionPort=new DenyAllOmegaDecision(),
    private readonly fingerprint:FingerprintPort|null=null,
    private readonly evidence:EvidenceVerifier=new DenyAllEvidenceVerifier(),
    private readonly nowMs:()=>number=Date.now
  ){}
  async issue(req:LeaseRequest,ownerProof:unknown,consentProof:unknown):Promise<void>{
    const stable=canonicalSnapshot(req).value as LeaseRequest;
    if(!valid(stable.principalId)) throw Error('INVALID_OWNER');
    const owner=await this.identity.authenticateOwner(ownerProof);
    if(!owner || owner.principalId!==stable.principalId) throw Error('OWNER_AUTH_FAILED');
    if(!(await this.consent.approveLease(stable,consentProof))) throw Error('CONSENT_REQUIRED');
    const lease:CapabilityLease={...stable,issuedAtMs:this.nowMs(),uses:0};
    await this.journal.grant(lease);
  }
  async revoke(leaseId:string,ownerProof:unknown,consentProof:unknown):Promise<void>{
    if(!valid(leaseId)) throw Error('INVALID_LEASE_ID');
    const owner=await this.identity.authenticateOwner(ownerProof);
    if(!owner || !valid(owner.principalId)) throw Error('OWNER_AUTH_FAILED');
    const lease=await this.journal.getLeaseForOwner(leaseId,owner.principalId);
    if(!lease) throw Error('LEASE_NOT_OWNED');
    if(!(await this.consent.approveRevocation(lease,consentProof))) throw Error('REVOCATION_NOT_AUTHORIZED');
    await this.journal.revokeForOwner(leaseId,owner.principalId);
  }
  async reserve(req:ActionRequest,agentProof:unknown):Promise<ReserveResult>{
    if(!this.fingerprint) throw Error('FINGERPRINT_PORT_REQUIRED');
    const stable=canonicalSnapshot(req).value as ActionRequest;
    if(!valid(stable.agentId)||!valid(stable.leaseId)||!valid(stable.actionId)) throw Error('INVALID_ACTION');
    const actor=await this.identity.authenticateAgent(agentProof);
    if(!actor||!valid(actor.principalId)||!valid(actor.agentId)||actor.agentId!==stable.agentId) throw Error('AGENT_AUTH_FAILED');
    if(!(await this.omega.allow(stable,actor))) throw Error('OMEGA_DENIED');
    const canonical=canonicalSnapshot([
      stable.actionId,stable.leaseId,stable.agentId,stable.capability,
      stable.scope,canonicalSnapshot(stable.payload).json
    ]);
    const digest=await this.fingerprint.sha256(canonical.json);
    return this.journal.reserve(stable,actor.principalId,digest);
  }
  async reconcile(actionId:string,fingerprint:string,outcome:'EXECUTED'|'FAILED',proof:unknown):Promise<void>{
    if(!(await this.evidence.verifyOutcome(actionId,fingerprint,outcome,proof))) throw Error('EVIDENCE_NOT_VERIFIED');
    await this.journal.reconcile(actionId,fingerprint,outcome);
  }
}
