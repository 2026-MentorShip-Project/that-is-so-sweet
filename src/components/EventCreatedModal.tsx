import React from "react";
import { X, Check, Share2 } from "lucide-react";
import { canShare, shareText } from "../share/share";
import { Button } from "../design-system/components";

interface EventCreatedModalProps {
  title: string;
  shareUrl: string;
  onClose: () => void;
  onCopySuccess: () => void;
}

// Shown after POST /api/events/ succeeds. Unlike ShareModal it only needs the
// { id, shareUrl } the backend returns, not a full EventData. Shown over the
// new event's page right after creation, in both the desktop and mobile trees.
export const EventCreatedModal: React.FC<EventCreatedModalProps> = ({ title, shareUrl, onClose, onCopySuccess }) => {
  const copyText = `【${title}】\n快來投票選你方便的時間吧！\n${shareUrl}`;

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopySuccess();
    } catch {
      window.prompt(msg, text);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,8,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 200 }}>
      <div style={{ background: "#fff", borderRadius: "var(--radius-modal)", padding: 24, width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto", position: "relative" }}>
        <button
          onClick={onClose}
          aria-label="關閉"
          style={{ position: "absolute", top: 16, right: 16, border: "none", background: "none", color: "var(--color-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <X size={18} />
        </button>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "var(--radius-pill)",
              background: "rgba(90,158,90,0.12)",
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 10px",
            }}
          >
            <Check size={26} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--color-ink)" }}>活動建立成功！</div>
          <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 4 }}>{title}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canShare && (
            <Button variant="secondary" fullWidth icon={<Share2 size={16} />} onClick={() => shareText({ title, text: copyText })}>
              分享
            </Button>
          )}
          <Button variant="primary" fullWidth onClick={() => copy(copyText, "複製邀請文字：")}>複製邀請文字</Button>
        </div>
        <div style={{ background: "var(--color-cream)", borderRadius: "var(--radius-md)", padding: 14, marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--color-ink)" }}>本活動專屬連結</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input readOnly value={shareUrl} style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: "var(--radius-input)", border: "1px solid var(--color-border)", fontSize: 12, background: "#fff", color: "var(--color-ink)" }} />
            <Button variant="dark" size="sm" onClick={() => copy(shareUrl, "複製活動連結：")}>複製</Button>
          </div>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.5 }}>
            把連結傳給朋友，團員不需要登入就能投票。
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button variant="ghost" fullWidth onClick={onClose}>查看活動</Button>
        </div>
      </div>
    </div>
  );
};
