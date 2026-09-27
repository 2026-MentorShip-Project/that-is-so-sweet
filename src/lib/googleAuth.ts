import { useCallback, useState } from "react";
import { AuthUser } from "../types";
import { googleSignIn } from "../api/authApi";

const KEYS = {
  access: "jiu_access_token",
  refresh: "jiu_refresh_token",
  user: "jiu_user",
} as const;

function readUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEYS.user);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function storeSession(access: string, refresh: string, user: AuthUser): void {
  localStorage.setItem(KEYS.access, access);
  localStorage.setItem(KEYS.refresh, refresh);
  localStorage.setItem(KEYS.user, JSON.stringify(user));
}

function clearSession(): void {
  localStorage.removeItem(KEYS.access);
  localStorage.removeItem(KEYS.refresh);
  localStorage.removeItem(KEYS.user);
}

export function useGoogleAuth() {
  const [user, setUser] = useState<AuthUser | null>(readUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loginWithIdToken = useCallback(async (idToken: string) => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await googleSignIn(idToken);
      storeSession(res.access, res.refresh, res.user);
      setUser(res.user);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "登入失敗，請重試");
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return { user, isAuthenticating, authError, loginWithIdToken, logout };
}
