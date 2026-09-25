import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { CreateEvent } from "./components/CreateEvent";
import { EventView } from "./components/EventView";
import { ShareModal } from "./components/ShareModal";
import { LoginScreen } from "./components/LoginScreen";
import { HostDashboard } from "./components/HostDashboard";
import { GoogleLoginOverlay } from "./components/GoogleLoginOverlay";
import { Toast } from "./components/Toast";
import { EventCreatedModal } from "./components/EventCreatedModal";
import { MobileApp } from "./mobile/MobileApp";
import { useViewport } from "./lib/useViewport";
import { useFakeAuth } from "./lib/fakeAuth";
import {
  EventData,
  CreateEventInput,
  SubmitResponseInput,
  SubmitCommentInput,
  UpdateEventInput,
  AiSelectedRestaurant,
  ToastMessage,
  EventSummary,
  CreateEventResult,
} from "./types";
import {
  fetchEvent,
  submitResponse,
  finalizeEvent,
  reopenEvent,
  cancelEvent,
  updateEvent,
  saveAiSelectedRestaurant,
  submitComment,
  getHostToken,
  getVisitedEvents,
  saveUserNickname,
  VisitedEventItem
} from "./lib/api";
import * as eventsApi from "./lib/eventsApi";
import { ApiError } from "./lib/http";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function App() {
  const { isMobile } = useViewport();
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [currentHostToken, setCurrentHostToken] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [initialTab, setInitialTab] = useState<"vote" | "heatmap" | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Modals & Toasts
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [historyList, setHistoryList] = useState<VisitedEventItem[]>([]);
  const { user, isAuthenticating, login, logout } = useFakeAuth();
  const [homeView, setHomeView] = useState<"dashboard" | "create">("dashboard");
  // "我揪的團" comes from GET /api/events/?owner=me (per account, not per device).
  const [myEvents, setMyEvents] = useState<EventSummary[]>([]);
  const [isLoadingMyEvents, setIsLoadingMyEvents] = useState(false);
  const [myEventsError, setMyEventsError] = useState<string | null>(null);
  const [createdEvent, setCreatedEvent] = useState<(CreateEventResult & { title: string }) | null>(null);
  // Host identity is only honored while "logged in" — logging out strips
  // host-only UI everywhere immediately, even on an event page already open,
  // without touching the stored per-event hostToken (logging back in
  // restores it).
  const effectiveHostToken = user ? currentHostToken : null;

  // Tracks an eventId whose data was just set directly in state (e.g. right
  // after creation), so the hashchange this triggers doesn't re-fetch it.
  const skipNextHashLoadRef = React.useRef<string | null>(null);

  const addToast = (type: "success" | "error" | "info", text: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper to parse URL hash parameters e.g. #event=xxx&hostToken=yyy
  const parseHashParams = () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const eventId = params.get("event");
    const token = params.get("hostToken");
    const tabParam = params.get("tab");
    const tab: "vote" | "heatmap" | null =
      tabParam === "vote" || tabParam === "heatmap" ? tabParam : null;
    return { eventId, token, tab };
  };

  const loadEvent = async (id: string, tokenParam?: string) => {
    setIsLoading(true);
    setPageError(null);
    try {
      if (id.startsWith("demo-")) {
        // Demo events only exist in the localStorage store.
        // Priority: tokenParam -> LocalStorage token
        const storedToken = getHostToken(id);
        const effectiveToken = tokenParam || storedToken || undefined;

        const data = await fetchEvent(id, effectiveToken);
        setEventData(data);
        setCurrentHostToken(effectiveToken || null);
      } else {
        const data = await eventsApi.getEvent(id);
        setEventData(data);
        setCurrentHostToken(data.isOwner ? eventsApi.API_OWNER_HOST_TOKEN : null);
      }
      setCurrentEventId(id);
    } catch (err: any) {
      setPageError(err instanceof ApiError ? err.displayMessage : err.message || "載入活動失敗");
      setEventData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // On mount and on hash change
  useEffect(() => {
    const handleHashChange = () => {
      const { eventId, token, tab } = parseHashParams();
      if (eventId) {
        setInitialTab(tab);
        // Skip re-fetching an event whose data we just set locally
        // (e.g. right after creating it) — the hash update below still
        // fires this listener, and a redundant fetch that happens to
        // fail would otherwise wipe out the data we already have.
        if (skipNextHashLoadRef.current === eventId) {
          skipNextHashLoadRef.current = null;
          return;
        }
        loadEvent(eventId, token || undefined);
      } else {
        // No event in hash -> show create event form
        setPageError(null);
        setCurrentEventId(null);
        setEventData(null);
        setInitialTab(null);
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Refresh the visited-events list whenever the "我的聚會" modal opens, or
  // whenever we land on the logged-in host home (no event in the hash) —
  // HostDashboard/HostHome need this list without the user opening the modal.
  useEffect(() => {
    if (isHistoryOpen || (!currentEventId && user)) {
      setHistoryList(getVisitedEvents());
    }
  }, [isHistoryOpen, currentEventId, user]);

  const loadMyEvents = async () => {
    setIsLoadingMyEvents(true);
    setMyEventsError(null);
    try {
      setMyEvents(await eventsApi.listMyEvents());
    } catch (err) {
      setMyEventsError(err instanceof ApiError ? err.displayMessage : "載入活動清單失敗");
    } finally {
      setIsLoadingMyEvents(false);
    }
  };

  useEffect(() => {
    if (user && !currentEventId && homeView === "dashboard") loadMyEvents();
  }, [user, currentEventId, homeView]);

  // Handlers
  // 回傳值供 CreateEvent/CreateWizard 判斷是否要清空草稿（草稿只在真的
  // 建立成功時清，驗證失敗或送出失敗都要保留，見 eventDraft.ts）。
  const handleCreateEvent = async (input: CreateEventInput): Promise<boolean> => {
    const invalid = eventsApi.validateCreateEventInput(input);
    if (invalid) {
      addToast("error", invalid);
      return false;
    }
    setIsLoading(true);
    try {
      const result = await eventsApi.createEvent(input);
      if (input.hostName) saveUserNickname(input.hostName);
      // GET /api/events/{id} isn't wired up yet, so instead of opening the
      // event page, show the share link and go back to "我揪的團" (which
      // refetches and now includes the new event).
      setCreatedEvent({ ...result, title: input.title });
      setHomeView("dashboard");
      addToast("success", "活動成功建立！專屬連結已產生");
      return true;
    } catch (err) {
      addToast("error", err instanceof ApiError ? err.displayMessage : "建立活動失敗，請重試");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespond = async (input: SubmitResponseInput) => {
    if (!currentEventId) return;
    setIsLoading(true);
    try {
      const updated = await submitResponse(currentEventId, input);
      setEventData(updated);
      addToast("success", "您的時間已成功記錄與更新！");
    } catch (err: any) {
      addToast("error", err.message || "送出時間失敗");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalize = async (finalSlotId: string, finalNote?: string) => {
    if (!currentEventId || !currentHostToken) return;
    setIsLoading(true);
    try {
      const updated = await finalizeEvent(currentEventId, {
        hostToken: currentHostToken,
        finalSlotId,
        finalNote,
      });
      setEventData(updated);
      addToast("success", "聚會時間已拍板定案！結果已發布");
    } catch (err: any) {
      addToast("error", err.message || "拍板定案失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReopen = async (newDeadline?: string) => {
    if (!currentEventId || !currentHostToken) return;
    setIsLoading(true);
    try {
      const updated = await reopenEvent(currentEventId, currentHostToken, newDeadline);
      setEventData(updated);
      addToast("info", "活動已重新開放投票統計");
    } catch (err: any) {
      addToast("error", err.message || "重新開放失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!currentEventId || !currentHostToken) return;
    setIsLoading(true);
    try {
      const updated = await cancelEvent(currentEventId, currentHostToken);
      setEventData(updated);
      addToast("info", "活動已取消");
    } catch (err: any) {
      addToast("error", err.message || "取消活動失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEvent = async (input: Omit<UpdateEventInput, "hostToken">) => {
    if (!currentEventId || !currentHostToken || !eventData) return;
    setIsLoading(true);
    try {
      const updated = currentEventId.startsWith("demo-")
        ? await updateEvent(currentEventId, { hostToken: currentHostToken, ...input })
        : await eventsApi.updateEvent(eventData, input);
      setEventData(updated);
      addToast("success", "活動資訊已更新");
    } catch (err: any) {
      addToast("error", err instanceof ApiError ? err.displayMessage : err.message || "更新活動資訊失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async (input: SubmitCommentInput) => {
    if (!currentEventId) return;
    try {
      const updated = await submitComment(currentEventId, input);
      setEventData(updated);
    } catch (err: any) {
      addToast("error", err.message || "送出留言失敗");
    }
  };

  const handleSelectAiRestaurant = async (restaurant: AiSelectedRestaurant) => {
    if (!currentEventId) return;
    try {
      const updated = await saveAiSelectedRestaurant(currentEventId, restaurant);
      setEventData(updated);
    } catch (err: any) {
      addToast("error", err.message || "儲存推薦餐廳失敗");
    }
  };

  const handleGoHome = (view: "dashboard" | "create" = "dashboard") => {
    window.location.hash = "";
    setPageError(null);
    setCurrentEventId(null);
    setEventData(null);
    setHomeView(view);
  };

  const handleLoadDemo = (id: string = "demo-gathering", hostToken?: string) => {
    window.location.hash = hostToken ? `event=${id}&hostToken=${hostToken}` : `event=${id}`;
  };

  if (isMobile) {
    return (
      <MobileApp
        currentEventId={currentEventId}
        eventData={eventData}
        currentHostToken={currentHostToken}
        initialTab={initialTab}
        isLoading={isLoading}
        pageError={pageError}
        onGoHome={handleGoHome}
        onCreateEvent={handleCreateEvent}
        onRespond={handleRespond}
        onFinalize={handleFinalize}
        onReopen={handleReopen}
        onCancelEvent={handleCancelEvent}
        onUpdateEvent={handleUpdateEvent}
        onSubmitComment={handleSubmitComment}
        onSelectAiRestaurant={handleSelectAiRestaurant}
        isShareModalOpen={isShareModalOpen}
        setIsShareModalOpen={setIsShareModalOpen}
        isHistoryOpen={isHistoryOpen}
        setIsHistoryOpen={setIsHistoryOpen}
        historyList={historyList}
        myEvents={myEvents}
        isLoadingMyEvents={isLoadingMyEvents}
        myEventsError={myEventsError}
        onRetryMyEvents={loadMyEvents}
        createdEvent={createdEvent}
        onCloseCreatedEvent={() => setCreatedEvent(null)}
        onSelectEvent={(id) => {
          window.location.hash = `event=${id}`;
        }}
        onLoadDemo={handleLoadDemo}
        onCopySuccess={() => addToast("success", "已成功複製到剪貼簿！")}
        toasts={toasts}
        user={user}
        isAuthenticating={isAuthenticating}
        onLogin={login}
        onLogout={logout}
        homeView={homeView}
        onOpenCreate={() => setHomeView("create")}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-cream)", color: "var(--color-ink)", fontFamily: "var(--font-body)", display: "flex", flexDirection: "column" }}>
      {/* Top Header */}
      <Header
        onNewEvent={() => handleGoHome()}
        onCreateEvent={() => handleGoHome("create")}
        onOpenMyEvents={() => handleGoHome()}
        isOnDashboardPage={!currentEventId && homeView === "dashboard"}
        onOpenShareModal={eventData ? () => setIsShareModalOpen(true) : undefined}
        activeEventTitle={eventData?.title}
        user={user}
        onLogin={login}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {isLoading && !eventData && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12, color: "var(--color-muted)" }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: "var(--color-primary)" }} />
            <p style={{ fontSize: 13, fontWeight: 700 }}>正在載入活動內容...</p>
          </div>
        )}

        {pageError && (
          <div style={{ maxWidth: 420, margin: "48px auto", padding: 24, background: "var(--color-surface)", borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-lg)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--color-hot-subtle)", color: "var(--color-hot)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <AlertTriangle size={22} />
            </div>
            <h3 style={{ fontWeight: 900, fontFamily: "var(--font-display)", fontSize: 17, color: "var(--color-ink)", marginBottom: 6 }}>讀取失敗</h3>
            <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 16 }}>{pageError}</p>
            <button
              onClick={() => handleGoHome()}
              style={{ padding: "10px 20px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--color-ink)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
            >
              返回建立新活動
            </button>
          </div>
        )}

        {!isLoading && !pageError && !currentEventId && (
          !user ? (
            <LoginScreen onLogin={login} />
          ) : homeView === "create" ? (
            <CreateEvent onSubmit={handleCreateEvent} isLoading={isLoading} hostEmail={user.email} />
          ) : (
            <HostDashboard
              events={myEvents}
              isLoadingEvents={isLoadingMyEvents}
              eventsError={myEventsError}
              onRetryEvents={loadMyEvents}
              onCreateEvent={() => setHomeView("create")}
              onSelectEvent={(id) => {
                window.location.hash = `event=${id}`;
              }}
              onLoadDemo={handleLoadDemo}
            />
          )
        )}

        {!pageError && currentEventId && eventData && (
          <EventView
            event={eventData}
            hostToken={effectiveHostToken || undefined}
            initialTab={initialTab || undefined}
            onRespond={handleRespond}
            onFinalize={handleFinalize}
            onReopen={handleReopen}
            onCancelEvent={handleCancelEvent}
            onUpdateEvent={handleUpdateEvent}
            onSubmitComment={handleSubmitComment}
        onSelectAiRestaurant={handleSelectAiRestaurant}
            onCopySuccess={() => addToast("success", "已成功複製到剪貼簿！")}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)", padding: "20px 0", textAlign: "center", fontSize: 11, color: "var(--color-muted)" }}>
        <p style={{ fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
          聚會時間協調神器 • 免註冊免登入 • 快速搞定朋友聚餐
        </p>
      </footer>

      {/* Share Modal */}
      {eventData && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          event={eventData}
          hostToken={effectiveHostToken || undefined}
          onCopySuccess={() => addToast("success", "已成功複製連結！")}
        />
      )}

      {createdEvent && (
        <EventCreatedModal
          title={createdEvent.title}
          shareUrl={createdEvent.shareUrl}
          onClose={() => setCreatedEvent(null)}
          onCopySuccess={() => addToast("success", "已成功複製連結！")}
        />
      )}

      {/* Floating Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={removeToast} />

      {/* Fake Google OAuth redirect/popup simulation */}
      {isAuthenticating && <GoogleLoginOverlay />}
    </div>
  );
}
