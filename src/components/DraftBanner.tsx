import React from "react";
import { FileClock } from "lucide-react";
import { formatDraftSavedAt } from "../share/storage/eventDraft";
import { Button } from "../design-system/components";

interface DraftBannerProps {
  savedAt: string;
  onResume: () => void;
  onDiscard: () => void;
}

// Asks the host what to do with an unfinished create-event draft. Shared by
// the desktop CreateEvent and mobile CreateWizard (like MonthCalendar is).
export const DraftBanner: React.FC<DraftBannerProps> = ({ savedAt, onResume, onDiscard }) => {
  const savedAtLabel = formatDraftSavedAt(savedAt);
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: "var(--color-primary-subtle)",
        border: "1.5px solid rgba(224,75,40,0.18)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--color-ink)", lineHeight: 1.5 }}>
        <FileClock size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <span style={{ fontWeight: 800 }}>偵測到未完成的活動草稿</span>
          {savedAtLabel && <span style={{ color: "var(--color-muted)" }}>（最後編輯於 {savedAtLabel}）</span>}
          <br />
          要接著編輯，還是捨棄重新填寫？
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" size="sm" fullWidth onClick={onResume}>繼續編輯</Button>
        <Button variant="muted" size="sm" fullWidth onClick={onDiscard}>捨棄</Button>
      </div>
    </div>
  );
};
