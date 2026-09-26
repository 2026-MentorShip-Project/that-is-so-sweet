import React from "react";
import { CalendarHeart, Loader2 } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

interface LoginScreenProps {
  onLogin: (idToken: string) => Promise<void>;
  isAuthenticating: boolean;
  authError?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isAuthenticating, authError }) => {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 4 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "var(--radius-lg)",
          background: "var(--color-primary)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <CalendarHeart size={26} />
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 17, color: "var(--color-ink)", margin: 0 }}>
        主揪請先登入
      </h2>
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 6, maxWidth: 280, marginBottom: 20 }}>
        建立活動與管理「我揪的團」需要先登入。團員收到活動連結後不需要登入即可投票。
      </p>
      {isAuthenticating ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-muted)", fontSize: 13 }}>
          <Loader2 size={16} className="animate-spin" />
          正在登入...
        </div>
      ) : (
        <>
          <GoogleLogin
            onSuccess={(res) => { void onLogin(res.credential!); }}
            onError={() => { /* user closed popup — no action needed */ }}
            size="large"
            shape="pill"
          />
          {authError && (
            <p style={{ fontSize: 11, color: "var(--color-hot)", marginTop: 8 }}>{authError}</p>
          )}
        </>
      )}
    </div>
  );
};
