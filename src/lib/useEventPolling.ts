import { useEffect, useRef } from "react";
import { EventPollStatus } from "../types";
import { getEventPoll } from "../api/eventsApi";
import { ApiError } from "../api/http";
import { pollChanges } from "../share/event/pollChanges";

export const POLL_INTERVAL_MS = 10_000;

export type PollChange = { event: boolean; comments: boolean; gone?: boolean };

// Polls GET /api/events/{id}/poll/ while the event page is open and calls
// onChange only when something differs from the previous poll, so the full
// event/comments are refetched on demand instead of every tick. Pauses while
// the tab is hidden and polls once as soon as it's visible again. A 404/410
// (event deleted or link expired) stops polling and reports `gone`.
export function useEventPolling(eventId: string | null, onChange: (change: PollChange) => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!eventId) return;
    let prev: EventPollStatus | null = null;
    let stopped = false;
    let inFlight = false;

    const tick = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const next = await getEventPoll(eventId);
        if (stopped) return;
        const change = pollChanges(prev, next);
        prev = next;
        if (change.event || change.comments) onChangeRef.current(change);
      } catch (err) {
        if (!stopped && err instanceof ApiError && (err.status === 404 || err.status === 410)) {
          stopped = true;
          onChangeRef.current({ event: true, comments: false, gone: true });
        }
        // Anything else (network blip, 5xx): try again on the next tick.
      } finally {
        inFlight = false;
      }
    };

    tick();
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [eventId]);
}
