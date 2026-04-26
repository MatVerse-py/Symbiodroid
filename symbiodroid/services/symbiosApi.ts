/**
 * SYMBIOS Evidence OS — Mobile API client (TypeScript / Expo / React Native)
 *
 * Drop this file at: services/symbiosApi.ts
 *
 * Usage:
 *   import { symbios } from "./services/symbiosApi";
 *   const { access_token } = await symbios.auth.login("perito@x.com", "senha123");
 *   const cases = await symbios.cases.list(access_token);
 *
 * Auth tokens MUST be stored with expo-secure-store (NOT AsyncStorage).
 * Webhook/Share secrets are server-only — never embed them in the app bundle.
 */

// ---------- Configuration ----------

/**
 * Override the base URL via Expo public env or build constant:
 *   EXPO_PUBLIC_SYMBIOS_API_URL=https://api.symbios.ai
 */
const ENV_URL =
  // @ts-ignore — process.env access at build time (Expo replaces this)
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_SYMBIOS_API_URL) || "";

let BASE_URL: string = ENV_URL || "https://api.symbios.ai";

export function setBaseUrl(url: string): void {
  BASE_URL = url.replace(/\/+$/, "");
}

export function getBaseUrl(): string {
  return BASE_URL;
}

// ---------- Types ----------

export interface UserPublic {
  id: string;
  email: string;
  full_name?: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  user: UserPublic;
}

export interface Case {
  case_id: string;
  owner_id: string;
  title: string;
  description: string;
  status: "created" | "uploaded" | "processing" | "processed" | "sealed";
  total_files: number;
  total_messages: number;
  total_flags: number;
  omega_status: "PENDING" | "OK" | "BLOCKED";
  webhook_url?: string | null;
  sealed_at?: string | null;
  seal_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceFile {
  file_id: string;
  case_id: string;
  filename: string;
  sha256: string;
  size_bytes: number;
  file_type: "txt" | "zip" | "image" | "audio" | "pdf" | "other";
  mime_type?: string | null;
  upload_status: "uploaded" | "processed" | "failed";
  uploaded_at: string;
  notes?: string | null;
}

export interface Event {
  event_id: string;
  case_id: string;
  timestamp?: string | null;
  raw_timestamp?: string | null;
  author?: string | null;
  message: string;
  source: "whatsapp" | "image" | "audio" | "pdf" | "manual";
  source_file_id?: string | null;
  source_sha256?: string | null;
  flags: string[];
  omega_status: "PENDING" | "OK" | "BLOCKED";
  review_status: "unreviewed" | "accepted" | "rejected";
  metadata: Record<string, unknown>;
}

export interface LedgerEntry {
  entry_id: string;
  case_id: string;
  timestamp?: string | null;
  amount?: number | null;
  currency: "BRL" | "USD" | string;
  description: string;
  direction: "in" | "out" | "unknown";
  source_event_id?: string | null;
  omega_status: "PENDING" | "OK" | "BLOCKED";
  missing_fields: string[];
}

export interface ProcessResult {
  case_id: string;
  status: string;
  total_files: number;
  total_messages: number;
  total_flags: number;
  omega_status: string;
  timeline_url: string;
  flags_url: string;
  ledger_url: string;
  report_url: string;
}

export interface LedgerSummary {
  total_in_brl: number;
  total_out_brl: number;
  total_unknown_brl: number;
  total_in_usd: number;
  total_out_usd: number;
  entries_count: number;
  blocked_count: number;
}

export interface PreviewResponse {
  case_id: string;
  title: string;
  status: string;
  omega_status: string;
  totals: { files: number; events: number; flags: number; ledger: number };
  flag_top: Record<string, number>;
  ledger_summary: LedgerSummary;
  executive_summary: string;
  has_llm_summary: boolean;
}

export interface CaseSeal {
  case_id: string;
  sealed_at: string;
  sealed_by: string;
  seal_hash: string;
  md_hash: string;
  files_snapshot: Array<{
    filename: string;
    sha256: string;
    size_bytes: number;
    file_type: string;
  }>;
  total_files: number;
  total_messages: number;
  total_flags: number;
  omega_status: string;
  pdf_size_bytes: number;
}

export interface SealVerifyResponse {
  case_id: string;
  valid: boolean;
  seal_hash_expected: string;
  seal_hash_current: string;
  sealed_at: string;
  issues: string[];
}

export interface ShareResponse {
  share_id: string;
  case_id: string;
  resource: "seal.pdf";
  token: string;
  url: string;
  expires_at: string;
  ttl_hours: number;
  created_at: string;
}

export interface ShareInfo {
  share_id: string;
  case_id: string;
  resource: string;
  expires_at: string;
  created_at: string;
  created_by: string;
  revoked: boolean;
  revoked_at?: string | null;
  access_count: number;
  last_accessed_at?: string | null;
}

export interface ShareAccessEntry {
  at: string;
  ip?: string | null;
  ua?: string | null;
}

export interface ShareLogResponse extends ShareInfo {
  access_log: ShareAccessEntry[];
}

// ---------- Error ----------

export class SymbiosApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown, message?: string) {
    super(message || `SYMBIOS API error ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

// ---------- Internal helpers ----------

interface FetchOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  json?: unknown;
  formData?: FormData;
  expect?: "json" | "blob" | "text" | "void";
}

async function call<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.formData) {
    body = opts.formData;
  }
  const res = await fetch(url, { method: opts.method || "GET", headers, body });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      try {
        detail = await res.text();
      } catch {
        /* noop */
      }
    }
    throw new SymbiosApiError(res.status, detail);
  }
  if (opts.expect === "void" || res.status === 204) return undefined as T;
  if (opts.expect === "blob") return (await res.blob()) as unknown as T;
  if (opts.expect === "text") return (await res.text()) as unknown as T;
  return (await res.json()) as T;
}

// ---------- Public API ----------

export const symbios = {
  // --- Health & meta ---
  health: () =>
    call<{ status: string; service: string; version: string; hf_configured: boolean }>(
      "/api/health"
    ),
  flagsCatalog: () =>
    call<{ flags: Array<{ id: string; severity: string; description: string }> }>(
      "/api/flags/catalog"
    ),

  // --- Auth ---
  auth: {
    register: (email: string, password: string, fullName?: string) =>
      call<TokenResponse>("/api/auth/register", {
        method: "POST",
        json: { email, password, full_name: fullName },
      }),
    login: (email: string, password: string) =>
      call<TokenResponse>("/api/auth/login", {
        method: "POST",
        json: { email, password },
      }),
    me: (token: string) => call<UserPublic>("/api/auth/me", { token }),
  },

  // --- Cases ---
  cases: {
    create: (
      token: string,
      payload: { title: string; description?: string; webhook_url?: string }
    ) => call<Case>("/api/cases", { method: "POST", token, json: payload }),
    list: (token: string) => call<Case[]>("/api/cases", { token }),
    get: (token: string, caseId: string) =>
      call<Case>(`/api/cases/${caseId}`, { token }),
    delete: (token: string, caseId: string) =>
      call<void>(`/api/cases/${caseId}`, { method: "DELETE", token, expect: "void" }),

    upload: (token: string, caseId: string, file: Blob | File, filename?: string) => {
      const fd = new FormData();
      // React Native: { uri, name, type } pattern is also supported by fetch
      // @ts-ignore
      fd.append("file", file as unknown, filename);
      return call<EvidenceFile>(`/api/cases/${caseId}/upload`, {
        method: "POST",
        token,
        formData: fd,
      });
    },

    process: (token: string, caseId: string) =>
      call<ProcessResult>(`/api/cases/${caseId}/process`, { method: "POST", token }),

    files: (token: string, caseId: string) =>
      call<EvidenceFile[]>(`/api/cases/${caseId}/files`, { token }),
    timeline: (token: string, caseId: string, limit = 1000) =>
      call<Event[]>(`/api/cases/${caseId}/timeline?limit=${limit}`, { token }),
    flags: (token: string, caseId: string) =>
      call<{
        case_id: string;
        flag_counts: Record<string, number>;
        events_with_flags: number;
      }>(`/api/cases/${caseId}/flags`, { token }),
    ledger: (token: string, caseId: string) =>
      call<LedgerEntry[]>(`/api/cases/${caseId}/ledger`, { token }),
    preview: (token: string, caseId: string) =>
      call<PreviewResponse>(`/api/cases/${caseId}/preview`, { token }),
    reportMarkdown: (token: string, caseId: string) =>
      call<string>(`/api/cases/${caseId}/report`, { token, expect: "text" }),
    reportPdfUrl: (caseId: string) => `${BASE_URL}/api/cases/${caseId}/report.pdf`,
    reportPdfBlob: (token: string, caseId: string) =>
      call<Blob>(`/api/cases/${caseId}/report.pdf`, { token, expect: "blob" }),
    analyze: (
      token: string,
      caseId: string,
      payload: { prompt?: string; max_tokens?: number; temperature?: number } = {}
    ) =>
      call<{ case_id: string; analysis: string; model: string }>(
        `/api/cases/${caseId}/analyze`,
        { method: "POST", token, json: payload }
      ),
  },

  // --- Events / review ---
  events: {
    review: (
      token: string,
      eventId: string,
      payload: { review_status: "accepted" | "rejected"; note?: string }
    ) =>
      call<Event>(`/api/events/${eventId}/review`, {
        method: "POST",
        token,
        json: payload,
      }),
  },

  // --- Seal (chain of custody) ---
  seal: {
    create: (token: string, caseId: string) =>
      call<CaseSeal>(`/api/cases/${caseId}/seal`, { method: "POST", token }),
    get: (token: string, caseId: string) =>
      call<CaseSeal>(`/api/cases/${caseId}/seal`, { token }),
    verify: (token: string, caseId: string) =>
      call<SealVerifyResponse>(`/api/cases/${caseId}/seal/verify`, { token }),
    pdfUrl: (caseId: string) => `${BASE_URL}/api/cases/${caseId}/seal.pdf`,
    pdfBlob: (token: string, caseId: string) =>
      call<Blob>(`/api/cases/${caseId}/seal.pdf`, { token, expect: "blob" }),
  },

  // --- Share (public temporary links to sealed PDF) ---
  share: {
    create: (token: string, caseId: string, ttlHours?: number) =>
      call<ShareResponse>(`/api/cases/${caseId}/share`, {
        method: "POST",
        token,
        json: ttlHours ? { ttl_hours: ttlHours } : {},
      }),
    list: (token: string, caseId: string) =>
      call<ShareInfo[]>(`/api/cases/${caseId}/shares`, { token }),
    log: (token: string, caseId: string, shareId: string) =>
      call<ShareLogResponse>(`/api/cases/${caseId}/shares/${shareId}/log`, { token }),
    revoke: (token: string, caseId: string, shareId: string) =>
      call<void>(`/api/cases/${caseId}/share/${shareId}`, {
        method: "DELETE",
        token,
        expect: "void",
      }),

    /** Resolve a public share token (no auth) — fetches the sealed PDF as a Blob. */
    publicFetch: (shareToken: string) =>
      call<Blob>(`/api/share/${shareToken}`, { expect: "blob" }),

    /** Build the public URL the user can copy/paste or open in a browser. */
    publicUrl: (shareToken: string) => `${BASE_URL}/api/share/${shareToken}`,
  },
};

export default symbios;
