import { DelegationKernel, LocalSandbox } from "../src/delegation";
import type { AuthorityPort, IdentityBoundary } from "../src/delegation";
// SIMULATOR ONLY. Neither these strings nor this code authenticate real people/devices.
const demoIdentity: IdentityBoundary = {
  async authenticateOwner(proof) { return proof === "demo-owner-session" ? { principalId: "owner" } : null; },
  async authenticateAgent(proof) { return proof === "demo-agent-session" ? { principalId: "owner", agentId: "agent.research" } : null; },
};
const demoConsent: AuthorityPort = {
  async approveLease(_request, proof) { return proof === "demo-owner-tap"; },
  async approveRevocation(_lease, proof) { return proof === "demo-owner-tap"; },
};
async function main(): Promise<void> {
  const kernel = new DelegationKernel(new LocalSandbox(), demoConsent, demoIdentity);
  await kernel.issueLease({
    leaseId: "demo.lease", principalId: "owner", agentId: "agent.research", scope: "workspace.demo",
    capability: "local.note.append", expiresAtMs: Date.now() + 60000, maxUses: 2,
  }, "demo-owner-session", "demo-owner-tap");
  const receipt = await kernel.execute({
    actionId: "demo.action", leaseId: "demo.lease", agentId: "agent.research", scope: "workspace.demo",
    capability: "local.note.append", payload: { text: "MatVerse governed local sandbox" },
  }, "demo-agent-session");
  console.log(JSON.stringify({ receipt, audit: kernel.getAudit() }, null, 2));
}
main().catch(e => { console.error(e); throw e; });
