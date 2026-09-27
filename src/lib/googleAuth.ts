import { useCallback, useEffect, useState } from "react";
import { AuthUser } from "../types";
import { googleSignIn, logoutApi } from "../api/authApi";

const KEYS = {
  access: "jiu_access_token",
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

function storeSession(access: string, user: AuthUser): void {
  localStorage.setItem(KEYS.access, access);
  localStorage.setItem(KEYS.user, JSON.stringify(user));
}

function clearSession(): void {
  localStorage.removeItem(KEYS.access);
  localStorage.removeItem(KEYS.user);
}

export function useGoogleAuth() {
  const [user, setUser] = useState<AuthUser | null>(readUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => {
      clearSession();
      setUser(null);
    };
    window.addEventListener("auth:session-expired", handler);
    return () => window.removeEventListener("auth:session-expired", handler);
  }, []);

  const loginWithIdToken = useCallback(async (idToken: string) => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await googleSignIn(idToken);
      storeSession(res.access, res.user);
      setUser(res.user);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "登入失敗，請重試");
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // best-effort — always clear session locally
    }
    clearSession();
    setUser(null);
  }, []);

  return { user, isAuthenticating, authError, loginWithIdToken, logout };
}
