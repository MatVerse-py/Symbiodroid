import { DelegationKernel, LocalSandbox } from "../src/delegation";
import type { AuthorityPort, CapabilityLease, LeaseRequest, ActionRequest } from "../src/delegation";

const ensure = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const expectThrow = async (f: () => Promise<unknown>, message: string) => {
  try { await f(); } catch { return; }
  throw new Error(message);
};
const authority: AuthorityPort = {
  async approveLease(_: Readonly<LeaseRequest>, proof: unknown) { return proof === "LOCAL_HUMAN_APPROVAL"; },
  async approveRevocation(_: Readonly<CapabilityLease>, proof: unknown) { return proof === "LOCAL_HUMAN_APPROVAL"; },
};
const request = (id: string, ms = 2000, maxUses = 3): LeaseRequest => ({
  leaseId: id, principalId: "owner", agentId: "agent.research", capability: "local.note.append",
  scope: "personal.notes", expiresAtMs: ms, maxUses,
});
const action = (actionId: string, leaseId: string, text = "hello"): ActionRequest => ({
  actionId, leaseId, agentId: "agent.research", capability: "local.note.append",
  scope: "personal.notes", payload: { text },
});

async function run(): Promise<void> {
  let time = 1000;
  const sandbox = new LocalSandbox();
  const kernel = new DelegationKernel(sandbox, authority, () => time);
  const tests: Array<[string, () => Promise<void>]> = [
    ["default deny", async () => {
      const denied = new DelegationKernel(new LocalSandbox());
      await expectThrow(() => denied.issueLease(request("deny", Date.now() + 200), "LOCAL_HUMAN_APPROVAL"), "untrusted consent accepted");
    }],
    ["consent mandatory", async () => {
      await expectThrow(() => kernel.issueLease(request("no-proof"), "not-a-proof"), "missing consent accepted");
    }],
    ["grant and execution", async () => {
      await kernel.issueLease(request("l1"), "LOCAL_HUMAN_APPROVAL");
      const first = await kernel.execute(action("a1", "l1"));
      ensure(first.status === "EXECUTED", "expected execution");
    }],
    ["idempotent duplicate", async () => {
      const [a, b] = await Promise.all([kernel.execute(action("same", "l1")), kernel.execute(action("same", "l1"))]);
      ensure(a.status === "EXECUTED" && a === b, "duplicate executed twice");
      ensure(kernel.getLease("l1")?.uses === 2, "duplicate spent a second use");
    }],
    ["id collision rejected", async () => {
      await expectThrow(() => kernel.execute(action("same", "l1", "different")), "action ID collision accepted");
    }],
    ["agent isolation", async () => {
      const res = await kernel.execute({ ...action("impersonation", "l1"), agentId: "agent.other" });
      ensure(res.status === "DENIED" && res.reason === "AGENT_MISMATCH", "agent isolation broken");
    }],
    ["scope isolation", async () => {
      const res = await kernel.execute({ ...action("scope", "l1"), scope: "another.scope" });
      ensure(res.status === "DENIED" && res.reason === "SCOPE_MISMATCH", "scope isolation broken");
    }],
    ["capability isolation", async () => {
      const res = await kernel.execute({ ...action("pay", "l1"), capability: "wallet.pay" as ActionRequest["capability"] });
      ensure(res.status === "DENIED", "forbidden capability accepted");
    }],
    ["limit exhausted", async () => {
      await kernel.execute(action("a3", "l1"));
      const denied = await kernel.execute(action("a4", "l1"));
      ensure(denied.reason === "BUDGET_EXHAUSTED", "limit bypassed");
    }],
    ["expires", async () => {
      await kernel.issueLease(request("exp", 1200), "LOCAL_HUMAN_APPROVAL");
      time = 1200;
      const denied = await kernel.execute(action("expired", "exp"));
      ensure(denied.reason === "LEASE_EXPIRED", "expired lease used");
      time = 1000;
    }],
    ["revocation requires authority", async () => {
      await kernel.issueLease(request("rev"), "LOCAL_HUMAN_APPROVAL");
      await expectThrow(() => kernel.revokeLease("rev", "invalid"), "unapproved revocation");
      await kernel.revokeLease("rev", "LOCAL_HUMAN_APPROVAL");
      const denied = await kernel.execute(action("post-revoke", "rev"));
      ensure(denied.reason === "LEASE_REVOKED", "revoked lease used");
    }],
    ["failure spends use; sensitive payload not audited", async () => {
      await kernel.issueLease(request("bad", 2000, 1), "LOCAL_HUMAN_APPROVAL");
      const failure = await kernel.execute(action("failed", "bad", ""));
      ensure(failure.status === "FAILED", "expected failure");
      const denied = await kernel.execute(action("retry", "bad"));
      ensure(denied.reason === "BUDGET_EXHAUSTED", "unbounded retries");
      ensure(!JSON.stringify(kernel.getAudit()).includes("payload"), "payload in audit");
    }],
    ["lease race and invalid horizon", async () => {
      await expectThrow(() => kernel.issueLease(request("long", 1000 + 86400000 + 1), "LOCAL_HUMAN_APPROVAL"), "unbounded lease");
      await expectThrow(() => kernel.issueLease(request("rev"), "LOCAL_HUMAN_APPROVAL"), "duplicate lease id");
    }],
  ];
  for (const [name, test] of tests) {
    await test();
    console.log("PASS", name);
  }
  console.log(tests.length + "/" + tests.length + " PASS");
}
run().catch((e: unknown) => { console.error("FAIL", e); throw e; });
