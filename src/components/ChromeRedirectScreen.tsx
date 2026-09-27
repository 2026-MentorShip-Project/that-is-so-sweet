import React, { useState } from "react";
import { buildChromeUrl } from "../lib/browserDetect";

export function ChromeRedirectScreen() {
  const [copied, setCopied] = useState(false);

  const handleOpenChrome = () => {
    window.location.href = buildChromeUrl(window.location.href);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--color-cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          padding: "40px 32px",
          maxWidth: 360,
          width: "100%",
          textAlign: "center",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 900,
            color: "var(--color-primary)",
            margin: "0 0 8px",
            lineHeight: 1.2,
          }}
        >
          歡迎來到揪甘心！
        </h1>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 800,
            color: "var(--color-ink)",
            margin: "0 0 16px",
          }}
        >
          請使用瀏覽器繼續
        </h2>

        <p
          style={{
            fontSize: 14,
            color: "var(--color-muted)",
            lineHeight: 1.6,
            margin: "0 0 32px",
          }}
        >
          為了順利完成 Google 登入，
          <br />
          請點選下方按鈕用 Chrome 開啟此頁面。
        </p>

        <button
          onClick={handleOpenChrome}
          style={{
            display: "block",
            width: "100%",
            padding: "16px",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background: "var(--color-primary)",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          用 Chrome 開啟
        </button>

        <button
          onClick={handleCopyLink}
          style={{
            display: "block",
            width: "100%",
            padding: "16px",
            borderRadius: "var(--radius-pill)",
            border: "1.5px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          {copied ? "已複製！" : "複製連結"}
        </button>
      </div>
    </div>
  );
}
