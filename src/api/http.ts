// Thin fetch wrapper for the real jiu-sync backend (Django REST).
//
// Auth is temporary: the Google login in this app is still simulated (see
// ../mocks/fakeAuth.ts), so there is no real JWT flow yet. Until the Auth module is
// wired up, the access token is pasted in manually — either via
// `localStorage.setItem("jiu_access_token", "<token>")` in the devtools
// console, or `VITE_DEV_ACCESS_TOKEN` in `.env.local`. localStorage wins so a
// fresh token can be swapped in without restarting Vite.

const ACCESS_TOKEN_KEY = "jiu_access_token";

let refreshPromise: Promise<void> | null = null;

async function tryRefreshToken(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "include",
    });
    if (!res.ok) {
      window.dispatchEvent(new Event("auth:session-expired"));
      throw new Error("token refresh failed");
    }
    const body = await res.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, body.access);
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export function getAccessToken(): string | null {
  try {
    const stored = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (stored) return stored;
  } catch {}
  return import.meta.env.VITE_DEV_ACCESS_TOKEN || null;
}

export interface ApiFieldError {
  field: string;
  code: string | null;
  message: string;
}

// Mirrors the backend's ApiError body: { message, code, errors? }.
export class ApiError extends Error {
  status: number;
  code: string | null;
  errors: ApiFieldError[];
  body: unknown; // full error body, for endpoint-specific extras

  constructor(status: number, message: string, code: string | null = null, errors: ApiFieldError[] = [], body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.body = body;
  }

  // Field errors are more useful to the user than the generic
  // "請求包含錯誤欄位" message, so surface them when present.
  get displayMessage(): string {
    if (this.errors.length > 0) return this.errors.map((e) => e.message).join("；");
    return this.message;
  }
}

export interface ApiFetchOptions extends RequestInit {
  // For public endpoints (e.g. GET /api/events/{id}/) that only use the token
  // to decide isOwner: an expired token makes DRF reject the whole request
  // with 401, so retry anonymously instead of locking participants out.
  optionalAuth?: boolean;
  skipAuth?: boolean;
  _retried?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { optionalAuth, skipAuth, _retried, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const token = skipAuth ? null : getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, "無法連線到伺服器，請確認後端是否已啟動");
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token && optionalAuth) {
      return apiFetch<T>(path, { ...options, skipAuth: true, _retried: true });
    }
    if (res.status === 401 && token && !skipAuth && !_retried) {
      await tryRefreshToken();
      return apiFetch<T>(path, { ...options, _retried: true });
    }
    if (res.status === 401 && !token && !skipAuth) {
      throw new ApiError(401, "尚未設定 access token，請先登入", "UNAUTHORIZED");
    }
    throw new ApiError(res.status, body?.message || `請求失敗（HTTP ${res.status}）`, body?.code ?? null, body?.errors ?? [], body);
  }
  return body as T;
}
