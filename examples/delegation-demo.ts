import { DelegationKernel, LocalSandbox } from "../src/delegation";
import type { AuthorityPort } from "../src/delegation";

// DEMO ONLY: in production, the approval check MUST be backed by a trusted owner UI,
// device authentication and/or signed authority verification. This string is not a secret.
const demoAuthority: AuthorityPort = {
  async approveLease(_req, approval) { return approval === "SIMULATED_OWNER_TAP"; },
  async approveRevocation(_lease, approval) { return approval === "SIMULATED_OWNER_TAP"; },
};

async function main() {
  const kernel = new DelegationKernel(new LocalSandbox(), demoAuthority);
  const until = Date.now() + 60_000;
  await kernel.issueLease({
    leaseId: "lease.demo.1", principalId: "human.owner", agentId: "agent.research",
    capability: "local.note.append", scope: "workspace.demo", expiresAtMs: until, maxUses: 2,
  }, "SIMULATED_OWNER_TAP");
  const receipt = await kernel.execute({
    actionId: "demo-action-1", leaseId: "lease.demo.1", agentId: "agent.research",
    capability: "local.note.append", scope: "workspace.demo", payload: { text: "MatVerse delegation demo" },
  });
  console.log(JSON.stringify({ receipt, lease: kernel.getLease("lease.demo.1"), audit: kernel.getAudit() }, null, 2));
}
main().catch((error: unknown) => { console.error(error); throw error; });
