import React, { useState } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { EventData, OlderCommentsControl, SubmitCommentInput } from "../../types";
import { canComment, formatCommentDate } from "../../share/eventStatus";
import { Avatar, Button, Input } from "../../design-system/components";
import { cardStyle, SectionLabel } from "./mobileStyles";

interface CommentBoardProps {
  event: EventData;
  nickname: string;
  setNickname: (v: string) => void;
  onSubmit: (input: SubmitCommentInput) => Promise<void>;
  /** Only passed for the host; shows a delete button on each comment. */
  onDelete?: (commentId: string) => Promise<void>;
  /** Real events load comments a page at a time; demo events have them all. */
  olderComments?: OlderCommentsControl;
  isLoading: boolean;
}

// Backend limit for POST /api/events/{id}/comments/.
const MESSAGE_MAX_LENGTH = 200;

export const CommentBoard: React.FC<CommentBoardProps> = ({ event, nickname, setNickname, onSubmit, onDelete, olderComments, isLoading }) => {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const comments = event.comments || [];
  const open = canComment(event);

  const handleSubmit = async () => {
    if (!nickname.trim() || !message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ nickname: nickname.trim(), message: message.trim() });
      setMessage("");
    } catch {
      // The caller already showed the error; keep the message so it can be resent.
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!onDelete) return;
    setConfirmingDeleteId(null);
    setDeletingId(commentId);
    try {
      await onDelete(commentId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={cardStyle}>
      <SectionLabel title="留言板" hint={open ? "參與者與主揪都可以在這裡留言討論" : "此活動已無法再留言"} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: open ? 14 : 0, maxHeight: 320, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
        {olderComments?.hasMore && (
          <button
            onClick={olderComments.onLoad}
            disabled={olderComments.isLoading}
            style={{ alignSelf: "center", border: "none", background: "none", padding: "2px 0", fontSize: 11, fontWeight: 700, color: "var(--color-primary)", cursor: olderComments.isLoading ? "default" : "pointer" }}
          >
            {olderComments.isLoading ? "載入中..." : "載入較早的留言"}
          </button>
        )}
        {comments.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: "10px 0" }}>
            <MessageSquare size={16} style={{ display: "block", margin: "0 auto 6px", opacity: 0.5 }} />
            還沒有人留言，來說句話吧！
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Avatar name={c.nickname} size="sm" />
              <div style={{ flex: 1, minWidth: 0, background: "var(--color-cream)", borderRadius: "var(--radius-md)", padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--color-ink)" }}>{c.nickname}</span>
                  <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{formatCommentDate(c.createdAt)}</span>
                  {onDelete && confirmingDeleteId !== c.id && (
                    <button
                      onClick={() => setConfirmingDeleteId(c.id)}
                      disabled={deletingId === c.id}
                      aria-label="刪除留言"
                      title="刪除留言"
                      style={{ marginLeft: "auto", border: "none", background: "none", padding: 0, cursor: "pointer", color: "var(--color-muted)", display: "inline-flex", alignItems: "center", alignSelf: "center" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-ink)", marginTop: 3, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {c.message}
                </div>
                {onDelete && confirmingDeleteId === c.id && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--color-border)", fontSize: 11, color: "var(--color-hot)", fontWeight: 700 }}>
                    <span style={{ flex: 1 }}>確定要刪除這則留言嗎？</span>
                    <Button variant="muted" size="xs" onClick={() => setConfirmingDeleteId(null)}>取消</Button>
                    <Button variant="hot" size="xs" onClick={() => handleDelete(c.id)}>刪除</Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: comments.length ? 12 : 0, borderTop: comments.length ? "1px solid var(--color-border)" : "none" }}>
          <Input size="sm" label="您的暱稱" required placeholder="例如：小明" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>
              留言內容<span style={{ color: "var(--color-primary)", marginLeft: 4 }}>*</span>
            </label>
            <div style={{ fontSize: 11, color: "var(--color-muted)" }}>在這邊留言會被寄信喔，請留下想讓大家看到的內容。</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="想跟大家說什麼？"
              maxLength={MESSAGE_MAX_LENGTH}
              rows={2}
              style={{
                width: "100%",
                resize: "vertical",
                border: "2px solid var(--color-border)",
                borderRadius: "var(--radius-input)",
                padding: "9px 12px",
                fontSize: 13,
                fontFamily: "var(--font-body)",
                color: "var(--color-ink)",
                background: "var(--color-surface)",
                outline: "none",
              }}
            />
          </div>
          <Button
            variant="dark"
            fullWidth
            disabled={!nickname.trim() || !message.trim() || submitting || isLoading}
            onClick={handleSubmit}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              送出留言
              <Send size={13} />
            </span>
          </Button>
        </div>
      )}
    </div>
  );
};
