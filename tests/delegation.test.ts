import { DelegationKernel, LocalSandbox, canonicalSnapshot } from "../src/delegation";
import type { AuthorityPort, IdentityBoundary, LeaseRequest, ActionRequest, ExecutionPort } from "../src/delegation";
const assert = (ok: unknown, why: string): void => { if (!ok) throw Error(why); };
const reject = async (fn: () => Promise<unknown>, why: string): Promise<void> => {
  try { await fn(); } catch { return; } throw Error(why);
};
let time = 1000;
const auth: IdentityBoundary = {
  async authenticateOwner(p) { return p === "owner-secret" ? { principalId: "owner" } : null; },
  async authenticateAgent(p) {
    if (p === "agent-secret") return { principalId: "owner", agentId: "agent" };
    if (p === "other-agent-secret") return { principalId: "owner", agentId: "other" };
    if (p === "foreign-principal") return { principalId: "foreign", agentId: "agent" };
    return null;
  },
};
const consent: AuthorityPort = {
  async approveLease(_r, approval) { return approval === "tap"; },
  async approveRevocation(_r, approval) { return approval === "tap"; },
};
const lease = (id: string, until = 3000, max = 3): LeaseRequest => ({
  leaseId: id, principalId: "owner", agentId: "agent", scope: "notes", capability: "local.note.append",
  expiresAtMs: until, maxUses: max,
});
const action = (id: string, l: string, payload: unknown = { text: "hello" }): ActionRequest => ({
  actionId: id, leaseId: l, agentId: "agent", scope: "notes", capability: "local.note.append", payload,
});
const kernel = new DelegationKernel(new LocalSandbox(), consent, auth, () => time);
const create = (id: string, until?: number, max?: number) => kernel.issueLease(lease(id, until, max), "owner-secret", "tap");
const act = (id: string, l: string, payload?: unknown) => kernel.execute(action(id, l, payload), "agent-secret");

async function run(): Promise<void> {
  const checks: Array<[string, () => Promise<void>]> = [
    ["fail closed default", async () => {
      const k = new DelegationKernel(new LocalSandbox());
      await reject(() => k.issueLease(lease("default", Date.now()+5000), "owner-secret", "tap"), "default granted");
      assert(k.getLease("default") === undefined, "stored default lease");
    }],
    ["owner authentication mandatory", async () => {
      await reject(() => kernel.issueLease(lease("no-owner"), "wrong", "tap"), "owner bypass");
    }],
    ["principal mismatch", async () => {
      await reject(() => kernel.issueLease({ ...lease("wrong-principal"), principalId: "other" }, "owner-secret", "tap"), "principal mismatch");
    }],
    ["consent mandatory", async () => {
      await reject(() => kernel.issueLease(lease("no-tap"), "owner-secret", "wrong"), "consent bypass");
    }],
    ["grant & action", async () => {
      await create("l1"); assert((await act("a1", "l1")).status === "EXECUTED", "execution failure");
    }],
    ["duplicate coalesced", async () => {
      const [a,b] = await Promise.all([act("dup", "l1"), act("dup", "l1")]);
      assert(a.status === "EXECUTED" && b.status === "EXECUTED", "duplicate status");
      assert(kernel.getLease("l1")?.uses === 2, "double use");
    }],
    ["unauthorized cache replay blocked", async () => {
      await reject(() => kernel.execute(action("dup", "l1"), "invalid"), "unauthorized receipt leaked");
      await reject(() => kernel.execute(action("dup", "l1"), "foreign-principal"), "cross-principal receipt leaked");
    }],
    ["action ID conflict", async () => {
      await reject(() => act("dup", "l1", { text: "different" }), "conflict accepted");
    }],
    ["authenticated agent cannot impersonate", async () => {
      await reject(() => kernel.execute(action("impersonate", "l1"), "other-agent-secret"), "impersonation accepted");
    }],
    ["scope mismatch", async () => {
      const r = await kernel.execute({ ...action("scope", "l1"), scope: "private" }, "agent-secret");
      assert(r.status === "DENIED" && r.reason === "SCOPE_MISMATCH", "scope allowed");
    }],
    ["capability mismatch", async () => {
      const r = await kernel.execute({ ...action("cap", "l1"), capability: "local.note.read" }, "agent-secret");
      assert(r.status === "DENIED" && r.reason === "CAPABILITY_MISMATCH", "capability allowed");
    }],
    ["budget exhausted", async () => {
      await act("a3", "l1");
      assert((await act("a4", "l1")).reason === "BUDGET_EXHAUSTED", "budget bypass");
    }],
    ["expires", async () => {
      await create("expire", 1300); time = 1300;
      assert((await act("expired", "expire")).reason === "LEASE_EXPIRED", "expiry bypass"); time = 1000;
    }],
    ["revocation owner consent", async () => {
      await create("revoke");
      await reject(() => kernel.revokeLease("revoke", "wrong", "tap"), "revoked without owner");
      await reject(() => kernel.revokeLease("revoke", "owner-secret", "wrong"), "revoked without approval");
      await kernel.revokeLease("revoke", "owner-secret", "tap");
      assert((await act("after-revoke", "revoke")).reason === "LEASE_REVOKED", "revocation bypass");
    }],
    ["expiry limit and duplicate lease", async () => {
      await reject(() => create("big", time+86_400_001), "oversize lease");
      await reject(() => create("l1"), "duplicate lease");
    }],
    ["canonical payload key order", async () => {
      assert(canonicalSnapshot({ a: 1, b: 2 }).json === canonicalSnapshot({ b: 2, a: 1 }).json, "unstable canonicalization");
    }],
    ["prototype pollution rejected", async () => {
      const malicious = JSON.parse('{"__proto__":{"role":"admin"}}');
      await reject(() => act("proto", "l1", malicious), "proto attack accepted");
    }],
    ["cyclic payload rejected", async () => {
      const cycle: { me?: unknown } = {}; cycle.me = cycle;
      await reject(() => act("cyclic", "l1", cycle), "cycle accepted");
    }],
    ["undefined and nonfinite rejected", async () => {
      await reject(() => act("undefined", "l1", { x: undefined }), "undefined allowed");
      await reject(() => act("nan", "l1", { x: NaN }), "NaN allowed");
    }],
    ["getter not invoked by canonicalizer", async () => {
      let read = false;
      const malicious = Object.defineProperty({}, "x", { enumerable: true, get() { read = true; throw Error("GETTER_TRIGGERED"); } });
      await reject(() => act("getter", "l1", malicious), "getter accepted");
      assert(!read, "getter was executed");
    }],
    ["sparse array and symbols rejected", async () => {
      await reject(() => act("sparse", "l1", [ , 42]), "sparse array accepted");
      await reject(() => act("symbols", "l1", { [Symbol("secret")]: 1 }), "symbol silently dropped");
    }],
    ["oversize payload rejected", async () => {
      await reject(() => act("oversize", "l1", { text: "z".repeat(33000) }), "oversize allowed");
    }],
    ["mutation after call cannot change request", async () => {
      await create("mutable");
      const payload = { text: "original" };
      const pending = act("mutation", "mutable", payload);
      payload.text = "tampered";
      const r = await pending;
      assert(r.status === "EXECUTED", "mutation execution fail");
      assert((await act("mutation", "mutable", { text: "original" })).status === "EXECUTED", "snapshot mismatch");
      await reject(() => act("mutation", "mutable", { text: "tampered" }), "mutated fingerprint accepted");
    }],
    ["executor failure exhausts use", async () => {
      await create("fail", 3000, 1);
      assert((await act("bad", "fail", { text: "" })).status === "FAILED", "failed result");
      assert((await act("retry", "fail")).reason === "BUDGET_EXHAUSTED", "retry unlimited");
    }],
    ["inflight revocation marked after completion", async () => {
      let release!: () => void;
      const wait = new Promise<void>(resolve => { release = resolve; });
      const ex: ExecutionPort = { async execute() { await wait; return { ok: true }; } };
      const k = new DelegationKernel(ex, consent, auth, () => time);
      await k.issueLease(lease("inflight"), "owner-secret", "tap");
      const pending = k.execute(action("running", "inflight"), "agent-secret");
      await Promise.resolve(); await Promise.resolve();
      await k.revokeLease("inflight", "owner-secret", "tap");
      release(); const r = await pending;
      assert(r.status === "EXECUTED" && r.reason === "COMPLETED_AFTER_REVOCATION", "inflight result misclassified");
    }],
    ["no raw payload stored in audit", async () => {
      assert(!JSON.stringify(kernel.getAudit()).includes("original"), "payload disclosed in audit");
      assert(kernel.getAudit().every(e => e.sequence > 0), "audit missing sequence");
    }],
  ];
  for (const [name, test] of checks) { await test(); console.log("PASS", name); }
  console.log(`${checks.length}/${checks.length} PASS`);
}
run().catch(e => { console.error("FAIL", e); throw e; });
