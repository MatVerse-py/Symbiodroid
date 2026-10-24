import type { ActionRequest, ExecutionPort } from "./contracts";

/** Demo-only, deterministic in-memory executor. NO network, filesystem, email or money access. */
export class LocalSandbox implements ExecutionPort {
  private readonly notes = new Map<string, string[]>();

  async execute(action: Readonly<ActionRequest>): Promise<unknown> {
    if (action.capability === "local.note.append") {
      const body = action.payload as { text?: unknown } | null;
      if (typeof body?.text !== "string" || body.text.length === 0 || body.text.length > 4096) {
        throw new Error("INVALID_NOTE");
      }
      const arr = this.notes.get(action.scope) ?? [];
      arr.push(body.text);
      this.notes.set(action.scope, arr);
      return { count: arr.length };
    }
    if (action.capability === "local.note.read") {
      return { notes: [...(this.notes.get(action.scope) ?? [])] };
    }
    if (action.capability === "local.math.sum") {
      const body = action.payload as { values?: unknown } | null;
      if (!Array.isArray(body?.values) || body.values.length > 100 ||
          body.values.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
        throw new Error("INVALID_VALUES");
      }
      const total = body.values.reduce((acc: number, n: number) => acc + n, 0);
      if (!Number.isFinite(total)) throw new Error("OVERFLOW");
      return { total };
    }
    throw new Error("UNSUPPORTED_CAPABILITY");
  }
}
