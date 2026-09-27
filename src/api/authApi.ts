import { AuthUser } from "../types";
import { apiFetch } from "./http";

export interface AuthResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export function googleSignIn(idToken: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/google/", {
    method: "POST",
    body: JSON.stringify({ idToken }),
    skipAuth: true,
  });
}
