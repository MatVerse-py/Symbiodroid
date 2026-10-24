/** Canonical immutable JSON subset. Rejects exotic prototypes, cycles, proto-pollution keys and oversize actions. */
const MAX_DEPTH = 12;
const MAX_KEYS = 512;
const MAX_BYTES = 32768;
const DANGEROUS = new Set(["__proto__", "prototype", "constructor"]);
const validKey = (key: string): boolean => !DANGEROUS.has(key) && !/[\u0000-\u001f]/.test(key);

export function canonicalSnapshot(value: unknown): { json: string; value: unknown } {
  const visited = new Set<object>();
  let members = 0;
  const walk = (input: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) throw Error("PAYLOAD_TOO_DEEP");
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number") {
      if (!Number.isFinite(input) || Object.is(input, -0)) throw Error("INVALID_NUMBER");
      return input;
    }
    if (typeof input !== "object") throw Error("NON_JSON_VALUE");
    if (visited.has(input)) throw Error("CYCLIC_OR_SHARED_OBJECT");
    visited.add(input);
    let result: unknown;
    if (Object.getOwnPropertySymbols(input).length) throw Error("SYMBOL_KEYS_FORBIDDEN");
    if (Array.isArray(input)) {
      if (Object.getPrototypeOf(input) !== Array.prototype) throw Error("UNSAFE_ARRAY_PROTOTYPE");
      if (input.length > MAX_KEYS) throw Error("PAYLOAD_TOO_LARGE");
      members += input.length;
      const out: unknown[] = [];
      for (let i = 0; i < input.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
        if (!descriptor || !Object.hasOwn(descriptor, "value")) throw Error("SPARSE_OR_ACCESSOR_ARRAY");
        out.push(walk(descriptor.value, depth + 1));
      }
      if (Object.keys(input).length !== input.length) throw Error("EXTRA_ARRAY_KEYS");
      result = out;
    } else {
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) throw Error("UNSAFE_PROTOTYPE");
      const keys = Object.keys(input).sort();
      members += keys.length;
      if (keys.length > MAX_KEYS) throw Error("PAYLOAD_TOO_LARGE");
      const object: Record<string, unknown> = Object.create(null);
      for (const key of keys) {
        if (!validKey(key)) throw Error("UNSAFE_KEY");
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor || !Object.hasOwn(descriptor, "value")) throw Error("ACCESSOR_FORBIDDEN");
        object[key] = walk(descriptor.value, depth + 1);
      }
      result = object;
    }
    visited.delete(input);
    if (members > MAX_KEYS) throw Error("PAYLOAD_TOO_LARGE");
    return Object.freeze(result);
  };
  const snapshot = walk(value, 0);
  const json = JSON.stringify(snapshot);
  if (json === undefined || new TextEncoder().encode(json).length > MAX_BYTES) throw Error("PAYLOAD_TOO_LARGE");
  return { json, value: snapshot };
}
