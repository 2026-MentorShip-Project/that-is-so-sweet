import React, { useState, useEffect } from "react";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { EventData, SubmitResponseInput, SubmitCommentInput, UpdateEventInput, AiSelectedRestaurant } from "../types";
import { getUserNickname, getUserEmail } from "../share/api";
import { getLifecycleStatus } from "../share/eventStatus";
import { Badge } from "../design-system/components";
import { VoteTab } from "./app/VoteTab";
import { HeatmapTab } from "./app/HeatmapTab";
import { FinalizedView } from "./app/FinalizedView";
import { CancelledView } from "./app/CancelledView";
import { CommentBoard } from "./app/CommentBoard";
import { EventInfoCard } from "./app/EventInfoCard";

interface EventViewProps {
  event: EventData;
  hostToken?: string;
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
  onSelectAiRestaurant: (restaurant: AiSelectedRestaurant) => void;
  onCopySuccess: () => void;
  isLoading: boolean;
}

export const EventView: React.FC<EventViewProps> = ({
  event,
  hostToken,
  initialTab,
  onRespond,
  onFinalize,
  onReopen,
  onCancelEvent,
  onUpdateEvent,
  isEditing,
  onEditingChange,
  onSubmitComment,
  onSelectAiRestaurant,
  onCopySuccess,
  isLoading,
}) => {
  const isHost = Boolean(hostToken && hostToken === event.hostToken);
  const [nickname, setNickname] = useState(() => getUserNickname());
  const [email, setEmail] = useState(() => getUserEmail());

  // The read-only stats page is always the landing state — visitors pick "我要投票" /
  // "更新投票" from its banner, which jumps straight into VoteTab's create/login mode.
  // Only an explicit tab=vote deep link skips straight to the vote entry screen.
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
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 60px" }}>
      <div style={{ position: "relative", borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-md)", background: "var(--color-surface)" }}>
        {(view === "identify_vote" || isHost) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", overflowX: "auto" }}>
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
          <>
            <CancelledView event={event} />
            <div style={{ marginTop: 12, borderTop: "8px solid var(--color-cream)", padding: "20px 20px 20px" }}>
              <CommentBoard event={event} nickname={nickname} setNickname={setNickname} onSubmit={onSubmitComment} isLoading={isLoading} />
            </div>
          </>
        ) : event.status === "finalized" ? (
          <>
            <FinalizedView event={event} isHost={isHost} onReopen={onReopen} onCancelEvent={isHost ? onCancelEvent : undefined} onSelectAiRestaurant={onSelectAiRestaurant} isLoading={isLoading} onCopySuccess={onCopySuccess} />
            <div style={{ marginTop: 12, borderTop: "8px solid var(--color-cream)", padding: "20px 20px 20px" }}>
              <CommentBoard event={event} nickname={nickname} setNickname={setNickname} onSubmit={onSubmitComment} isLoading={isLoading} />
            </div>
          </>
        ) : (
          <>
            {view === "identify_vote" && (
              <VoteTab
                event={event}
                nickname={nickname}
                setNickname={setNickname}
                email={email}
                setEmail={setEmail}
                onSubmit={onRespond}
                isLoading={isLoading}
                onSubmitted={() => setView("heatmap")}
                stickyFooter={false}
                initialMode={voteEntryMode}
                onCancel={() => setView("heatmap")}
              />
            )}
            {view === "heatmap" && (
              <>
                <div style={{ padding: "20px 20px 0" }}>
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
                  layout="desktop"
                />
                <div style={{ marginTop: 12, borderTop: "8px solid var(--color-cream)", padding: "20px 20px 20px" }}>
                  <CommentBoard event={event} nickname={nickname} setNickname={setNickname} onSubmit={onSubmitComment} isLoading={isLoading} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
