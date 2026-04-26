const ENV_URL =
  typeof process !== "undefined" && process.env?.EXPO_PUBLIC_SYMBIOS_API_URL
    ? process.env.EXPO_PUBLIC_SYMBIOS_API_URL
    : "";

let BASE_URL = (ENV_URL || "https://api.symbios.ai").replace(/\/+$/, "");

export function setSymbiosBaseUrl(url: string) {
  BASE_URL = url.replace(/\/+$/, "");
}

export function getSymbiosBaseUrl() {
  return BASE_URL;
}

export class SymbiosApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(`SYMBIOS API error ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

type Method = "GET" | "POST" | "DELETE";

async function request<T>(
  path: string,
  options: {
    method?: Method;
    token?: string;
    json?: unknown;
    formData?: FormData;
    expect?: "json" | "text" | "blob" | "void";
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  } else if (options.formData) {
    body = options.formData;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body,
  });

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text().catch(() => null);
    }
    throw new SymbiosApiError(response.status, detail);
  }

  if (options.expect === "void" || response.status === 204) return undefined as T;
  if (options.expect === "text") return (await response.text()) as T;
  if (options.expect === "blob") return (await response.blob()) as T;
  return (await response.json()) as T;
}

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: { id: string; email: string; full_name?: string | null; created_at: string };
};

export type CaseSeal = {
  case_id: string;
  sealed_at: string;
  sealed_by: string;
  seal_hash: string;
  md_hash: string;
  pdf_size_bytes: number;
  files_snapshot: Array<{ filename: string; sha256: string; size_bytes: number; file_type: string }>;
};

export type ShareInfo = {
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
};

export type ShareLog = ShareInfo & {
  access_log: Array<{ at: string; ip?: string | null; ua?: string | null }>;
};

export const symbiosApi = {
  health: () => request<{ status: string; service?: string; version?: string }>("/api/health"),

  auth: {
    register: (email: string, password: string, full_name?: string) =>
      request<AuthResponse>("/api/auth/register", {
        method: "POST",
        json: { email, password, full_name },
      }),
    login: (email: string, password: string) =>
      request<AuthResponse>("/api/auth/login", {
        method: "POST",
        json: { email, password },
      }),
    me: (token: string) => request("/api/auth/me", { token }),
  },

  cases: {
    create: (token: string, payload: { title: string; description?: string; webhook_url?: string }) =>
      request("/api/cases", { method: "POST", token, json: payload }),
    list: (token: string) => request("/api/cases", { token }),
    get: (token: string, caseId: string) => request(`/api/cases/${caseId}`, { token }),
    process: (token: string, caseId: string) =>
      request(`/api/cases/${caseId}/process`, { method: "POST", token }),
    preview: (token: string, caseId: string) => request(`/api/cases/${caseId}/preview`, { token }),
    timeline: (token: string, caseId: string) => request(`/api/cases/${caseId}/timeline`, { token }),
    flags: (token: string, caseId: string) => request(`/api/cases/${caseId}/flags`, { token }),
    ledger: (token: string, caseId: string) => request(`/api/cases/${caseId}/ledger`, { token }),
    reportMarkdown: (token: string, caseId: string) =>
      request<string>(`/api/cases/${caseId}/report`, { token, expect: "text" }),
    reportPdfBlob: (token: string, caseId: string) =>
      request<Blob>(`/api/cases/${caseId}/report.pdf`, { token, expect: "blob" }),
    upload: (token: string, caseId: string, formData: FormData) =>
      request(`/api/cases/${caseId}/upload`, { method: "POST", token, formData }),
  },

  seal: {
    create: (token: string, caseId: string) =>
      request<CaseSeal>(`/api/cases/${caseId}/seal`, { method: "POST", token }),
    get: (token: string, caseId: string) => request<CaseSeal>(`/api/cases/${caseId}/seal`, { token }),
    verify: (token: string, caseId: string) => request(`/api/cases/${caseId}/seal/verify`, { token }),
    pdfBlob: (token: string, caseId: string) =>
      request<Blob>(`/api/cases/${caseId}/seal.pdf`, { token, expect: "blob" }),
  },

  share: {
    create: (token: string, caseId: string, ttl_hours?: number) =>
      request(`/api/cases/${caseId}/share`, {
        method: "POST",
        token,
        json: ttl_hours ? { ttl_hours } : {},
      }),
    list: (token: string, caseId: string) =>
      request<ShareInfo[]>(`/api/cases/${caseId}/shares`, { token }),
    log: (token: string, caseId: string, shareId: string) =>
      request<ShareLog>(`/api/cases/${caseId}/shares/${shareId}/log`, { token }),
    revoke: (token: string, caseId: string, shareId: string) =>
      request<void>(`/api/cases/${caseId}/share/${shareId}`, {
        method: "DELETE",
        token,
        expect: "void",
      }),
    publicFetch: (shareToken: string) => request<Blob>(`/api/share/${shareToken}`, { expect: "blob" }),
    publicUrl: (shareToken: string) => `${BASE_URL}/api/share/${shareToken}`,
  },
};

export default symbiosApi;
