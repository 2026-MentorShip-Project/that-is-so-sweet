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
import { MobileApp } from "./pages/app/MobileApp";
import { useViewport } from "./share/useViewport";
import { useFakeAuth } from "./mocks/fakeAuth";
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
} from "./share/api";
import * as eventsApi from "./api/eventsApi";
import { ApiError } from "./api/http";
import { AppRoute, RouteTarget, buildUrl, parseRoute } from "./share/router";
import { RefreshCw, AlertTriangle } from "lucide-react";

const BASE_PATH = import.meta.env.BASE_URL;

// demo-* events only exist in the localStorage store; everything else is the backend's.
const isDemoEvent = (eventId: string) => eventId.startsWith("demo-");

const errorMessage = (err: any, fallback: string): string =>
  err instanceof ApiError ? err.displayMessage : err?.message || fallback;

function currentRoute(): AppRoute {
  return parseRoute(window.location, BASE_PATH);
}

export default function App() {
  const { isMobile } = useViewport();
  // The URL is the source of truth for which screen is shown (see lib/router.ts).
  const [route, setRoute] = useState<AppRoute>(currentRoute);
  const currentEventId = route.name === "event" ? route.eventId : null;
  const homeView: "dashboard" | "create" = route.name === "create" ? "create" : "dashboard";
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

  const navigate = (target: RouteTarget, options: { replace?: boolean } = {}) => {
    const url = buildUrl(target, BASE_PATH);
    if (options.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setRoute(currentRoute());
  };

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

  // Guards against a slow response for a previous event overwriting the one
  // the user has since navigated to.
  const latestEventLoadRef = React.useRef<string | null>(null);

  const loadEvent = async (id: string, tokenParam?: string) => {
    latestEventLoadRef.current = id;
    setIsLoading(true);
    setPageError(null);
    try {
      if (isDemoEvent(id)) {
        // Demo events only exist in the localStorage store.
        // Priority: tokenParam -> LocalStorage token
        const storedToken = getHostToken(id);
        const effectiveToken = tokenParam || storedToken || undefined;

        const data = await fetchEvent(id, effectiveToken);
        if (latestEventLoadRef.current !== id) return;
        setEventData(data);
        setCurrentHostToken(effectiveToken || null);
      } else {
        const data = await eventsApi.getEvent(id);
        if (latestEventLoadRef.current !== id) return;
        setEventData(data);
        setCurrentHostToken(data.isOwner ? eventsApi.API_OWNER_HOST_TOKEN : null);
      }
    } catch (err: any) {
      if (latestEventLoadRef.current !== id) return;
      setPageError(err instanceof ApiError ? err.displayMessage : err.message || "載入活動失敗");
      setEventData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Browser back/forward, plus a one-time rewrite of old "#event=" links
  // (and the backend's shareUrl) to the canonical path.
  useEffect(() => {
    const initial = currentRoute();
    const canonical = buildUrl(initial, BASE_PATH);
    if (window.location.hash || window.location.pathname + window.location.search !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Load the event whenever the route points at a different one. Toggling
  // /edit or the tab on the same event doesn't refetch.
  const routeHostToken = route.name === "event" ? route.hostToken : null;
  useEffect(() => {
    setPageError(null);
    if (route.name !== "event") {
      latestEventLoadRef.current = null;
      setEventData(null);
      setCurrentHostToken(null);
      setInitialTab(null);
      return;
    }
    setInitialTab(route.tab);
    setEventData((prev) => (prev?.id === route.eventId ? prev : null));
    loadEvent(route.eventId, route.hostToken || undefined);
  }, [currentEventId, routeHostToken]);

  // Refresh the visited-events list whenever the "我的聚會" modal opens, or
  // whenever we land on the logged-in host home (no event in the URL) —
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
  const handleCreateEvent = async (input: CreateEventInput) => {
    const invalid = eventsApi.validateCreateEventInput(input);
    if (invalid) {
      addToast("error", invalid);
      return;
    }
    setIsLoading(true);
    try {
      const result = await eventsApi.createEvent(input);
      if (input.hostName) saveUserNickname(input.hostName);
      // Open the new event's page, with the share link on top.
      setCreatedEvent({ ...result, title: input.title });
      navigate({ name: "event", eventId: result.id });
      addToast("success", "活動成功建立！專屬連結已產生");
    } catch (err) {
      addToast("error", err instanceof ApiError ? err.displayMessage : "建立活動失敗，請重試");
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
      const updated = isDemoEvent(currentEventId)
        ? await finalizeEvent(currentEventId, { hostToken: currentHostToken, finalSlotId, finalNote })
        : await eventsApi.finalizeEvent(currentEventId, { finalSlotId, finalNote });
      setEventData(updated);
      addToast("success", "聚會時間已拍板定案！結果已發布");
    } catch (err: any) {
      addToast("error", errorMessage(err, "拍板定案失敗"));
    } finally {
      setIsLoading(false);
    }
  };

  // "重新開放投票" appears in two states: a finalized event (backend reopen)
  // and an active event whose deadline has passed (backend reopen rejects
  // that with 409 EVENT_NOT_FINALIZED, so the deadline is extended via PATCH).
  const handleReopen = async (newDeadline?: string) => {
    if (!currentEventId || !currentHostToken || !eventData) return;
    setIsLoading(true);
    try {
      let updated: EventData;
      if (isDemoEvent(currentEventId)) {
        updated = await reopenEvent(currentEventId, currentHostToken, newDeadline);
      } else if (!newDeadline) {
        throw new Error("請設定新的投票截止時間");
      } else if (eventData.status === "finalized") {
        updated = await eventsApi.reopenEvent(currentEventId, newDeadline);
      } else {
        const { title, description, location, hostName, hostEmail } = eventData;
        updated = await eventsApi.updateEvent(eventData, { title, description, location, hostName, hostEmail, responseDeadline: newDeadline });
      }
      setEventData(updated);
      addToast("info", "活動已重新開放投票統計");
    } catch (err: any) {
      addToast("error", errorMessage(err, "重新開放失敗"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!currentEventId || !currentHostToken) return;
    setIsLoading(true);
    try {
      const updated = isDemoEvent(currentEventId)
        ? await cancelEvent(currentEventId, currentHostToken)
        : await eventsApi.cancelEvent(currentEventId);
      setEventData(updated);
      addToast("info", "活動已取消");
    } catch (err: any) {
      addToast("error", errorMessage(err, "取消活動失敗"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEvent = async (input: Omit<UpdateEventInput, "hostToken">) => {
    if (!currentEventId || !currentHostToken || !eventData) return;
    setIsLoading(true);
    try {
      const updated = isDemoEvent(currentEventId)
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
    navigate(view === "create" ? { name: "create" } : { name: "home" });
  };

  const handleSelectEvent = (id: string) => navigate({ name: "event", eventId: id });

  // /events/{id}/edit opens the edit dialog. Opening pushes the /edit entry,
  // so closing it steps back; a page loaded directly at /edit has nothing of
  // ours to go back to, so closing replaces the URL instead.
  const isEditing = route.name === "event" && route.edit;
  const editOpenedInAppRef = React.useRef(false);
  const handleEditingChange = (open: boolean) => {
    if (route.name !== "event" || open === route.edit) return;
    if (open) {
      editOpenedInAppRef.current = true;
      navigate({ name: "event", eventId: route.eventId, hostToken: route.hostToken, edit: true });
    } else if (editOpenedInAppRef.current) {
      editOpenedInAppRef.current = false;
      window.history.back();
    } else {
      navigate({ name: "event", eventId: route.eventId, hostToken: route.hostToken }, { replace: true });
    }
  };

  const handleLoadDemo = (id: string = "demo-gathering", hostToken?: string) => {
    navigate({ name: "event", eventId: id, hostToken });
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
        isEditing={isEditing}
        onEditingChange={handleEditingChange}
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
        onSelectEvent={handleSelectEvent}
        onLoadDemo={handleLoadDemo}
        onCopySuccess={() => addToast("success", "已成功複製到剪貼簿！")}
        toasts={toasts}
        user={user}
        isAuthenticating={isAuthenticating}
        onLogin={login}
        onLogout={logout}
        homeView={homeView}
        onOpenCreate={() => navigate({ name: "create" })}
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
              onCreateEvent={() => navigate({ name: "create" })}
              onSelectEvent={handleSelectEvent}
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
            isEditing={isEditing}
            onEditingChange={handleEditingChange}
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
