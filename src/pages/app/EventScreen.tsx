import React, { useState, useEffect } from "react";
import { Share2, History, Home, CalendarDays, ChevronLeft } from "lucide-react";
import { OlderCommentsControl, EventData, SubmitResponseInput, SubmitCommentInput, UpdateEventInput, AiSelectedRestaurant } from "../../types";
import { getUserNickname, getUserEmail } from "../../share/api";
import { getLifecycleStatus } from "../../share/eventStatus";
import { Badge } from "../../design-system/components";
import { TopBar } from "../../components/app/TopBar";
import { VoteTab } from "../../components/app/VoteTab";
import { HeatmapTab } from "../../components/app/HeatmapTab";
import { FinalizedView } from "../../components/app/FinalizedView";
import { CancelledView } from "../../components/app/CancelledView";
import { CommentBoard } from "../../components/app/CommentBoard";
import { EventInfoCard } from "../../components/app/EventInfoCard";
import { iconBtnStyle } from "../../components/app/mobileStyles";

interface EventScreenProps {
  event: EventData;
  isHost: boolean;
  initialTab?: "vote" | "heatmap";
  onRespond: (input: SubmitResponseInput) => Promise<void>;
  onFinalize: (finalSlotId: string, finalNote?: string) => Promise<void>;
  onReopen: (newDeadline?: string) => Promise<void>;
  onCancelEvent: () => Promise<void>;
  onUpdateEvent?: (input: Omit<UpdateEventInput, "hostToken">) => Promise<void>;
  /** Edit dialog open state — driven by the /events/{id}/edit URL. */
  isEditing?: boolean;
  onEditingChange?: (open: boolean) => void;
  onSubmitComment: (input: SubmitCommentInput) => Promise<void>;
  /** Host-only; omitted for demo events, which have no delete in the local store. */
  onDeleteComment?: (commentId: string) => Promise<void>;
  olderComments?: OlderCommentsControl;
  onSelectAiRestaurant: (restaurant: AiSelectedRestaurant) => void;
  onNewEvent: () => void;
  onOpenShare: () => void;
  onOpenHistory: () => void;
  onCopySuccess: () => void;
  isLoading: boolean;
}

export const EventScreen: React.FC<EventScreenProps> = ({
  event,
  isHost,
  initialTab,
  onRespond,
  onFinalize,
  onReopen,
  onCancelEvent,
  onUpdateEvent,
  isEditing,
  onEditingChange,
  onSubmitComment,
  onDeleteComment,
  olderComments,
  onSelectAiRestaurant,
  onNewEvent,
  onOpenShare,
  onOpenHistory,
  onCopySuccess,
  isLoading,
}) => {
  const [nickname, setNickname] = useState(() => getUserNickname());
  const [email, setEmail] = useState(() => getUserEmail());

  // 第一次進來一律先看熱點圖（目前大家的投票狀態）；只有明確點了「我要投票」
  // 或透過帶 tab=vote 的邀請連結進來，才會直接顯示投票輸入畫面。
  const [view, setView] = useState<"identify_vote" | "heatmap">(
    initialTab === "vote" ? "identify_vote" : "heatmap"
  );
  const [voteEntryMode, setVoteEntryMode] = useState<"create" | "login" | undefined>(undefined);

  const goToVote = (target: "create" | "login") => {
    setVoteEntryMode(target);
    setView("identify_vote");
  };

  // Re-apply the requested view whenever the URL asks for one — covers not just the
  // first mount but also navigating here via a URL change (e.g. pasting the
  // participant link while the app is already open in the same tab).
  useEffect(() => {
    if (initialTab === "vote") setView("identify_vote");
    else if (initialTab === "heatmap") setView("heatmap");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, initialTab]);

  // The edit dialog lives in the heatmap (host) view, so /edit switches to it.
  useEffect(() => {
    if (isEditing) setView("heatmap");
  }, [isEditing]);

  const lifecycle = getLifecycleStatus(event);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
      <TopBar
        title={event.title}
        right={
          <>
            <button style={iconBtnStyle} onClick={onOpenShare}><Share2 size={15} /></button>
            <button style={iconBtnStyle} onClick={onOpenHistory}><History size={15} /></button>
            <button style={iconBtnStyle} onClick={onNewEvent} title="回到我的活動"><Home size={15} /></button>
          </>
        }
      />
      {(view === "identify_vote" || isHost) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", flexShrink: 0, overflowX: "auto" }}>
          {view === "identify_vote" && (
            <button
              onClick={() => setView("heatmap")}
              style={{ display: "inline-flex", alignItems: "center", gap: 2, border: "none", background: "none", color: "var(--color-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, padding: 0, whiteSpace: "nowrap" }}
            >
              <ChevronLeft size={13} />
              返回統計頁面
            </button>
          )}
          {isHost && <Badge variant="secondary" size="sm">主揪</Badge>}
        </div>
      )}

      {event.status === "cancelled" ? (
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
          <CancelledView event={event} />
          <div style={{ marginTop: 10, borderTop: "8px solid var(--color-cream)", padding: "16px 14px 14px" }}>
            <CommentBoard event={event} nickname={nickname} setNickname={setNickname} onSubmit={onSubmitComment} onDelete={isHost ? onDeleteComment : undefined} olderComments={olderComments} isLoading={isLoading} />
          </div>
        </div>
      ) : event.status === "finalized" ? (
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
          <FinalizedView event={event} isHost={isHost} onReopen={onReopen} onCancelEvent={isHost ? onCancelEvent : undefined} onSelectAiRestaurant={onSelectAiRestaurant} isLoading={isLoading} onCopySuccess={onCopySuccess} />
          <div style={{ marginTop: 10, borderTop: "8px solid var(--color-cream)", padding: "16px 14px 14px" }}>
            <CommentBoard event={event} nickname={nickname} setNickname={setNickname} onSubmit={onSubmitComment} onDelete={isHost ? onDeleteComment : undefined} olderComments={olderComments} isLoading={isLoading} />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
          {view === "identify_vote" && (
            <VoteTab
              isHost={isHost}
              event={event}
              nickname={nickname}
              setNickname={setNickname}
              email={email}
              setEmail={setEmail}
              onSubmit={onRespond}
              isLoading={isLoading}
              onSubmitted={() => setView("heatmap")}
              initialMode={voteEntryMode}
              onCancel={() => setView("heatmap")}
            />
          )}
          {view === "heatmap" && (
            <>
              <div style={{ padding: "14px 14px 0" }}>
                <EventInfoCard
                  title={event.title}
                  hostName={event.hostName}
                  location={event.location}
                  description={event.description}
                  responseDeadlineIso={event.responseDeadline}
                  statusLabel={lifecycle.label}
                  statusColor={lifecycle.color}
                />
              </div>
              <HeatmapTab
                event={event}
                userNickname={nickname}
                onGoToVote={goToVote}
              isHost={isHost}
                onFinalize={onFinalize}
                onReopen={onReopen}
                onCancelEvent={onCancelEvent}
                onUpdateEvent={onUpdateEvent}
                isEditing={isEditing}
                onEditingChange={onEditingChange}
                isLoading={isLoading}
              />
              <div style={{ marginTop: 10, borderTop: "8px solid var(--color-cream)", padding: "16px 14px 14px" }}>
                <CommentBoard event={event} nickname={nickname} setNickname={setNickname} onSubmit={onSubmitComment} onDelete={isHost ? onDeleteComment : undefined} olderComments={olderComments} isLoading={isLoading} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
