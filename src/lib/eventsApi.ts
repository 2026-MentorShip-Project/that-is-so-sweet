// Events module (模組01/03/07/10) against the real backend. The rest of the
// app still goes through ./api.ts (localStorage) until each endpoint is
// migrated.
import { CreateEventInput, CreateEventRequest, CreateEventResult, EventSummary } from "../types";
import { apiFetch } from "./http";

export function listMyEvents(): Promise<EventSummary[]> {
  return apiFetch<EventSummary[]>("/api/events/?owner=me");
}

// The form keeps slot times as "HH:MM" (and "" in date_only mode); the API
// wants "HH:MM:SS" or null.
export function toCreateEventRequest(input: CreateEventInput): CreateEventRequest {
  const isDateOnly = input.mode === "date_only";
  return {
    title: input.title,
    hostNickname: input.hostName || "",
    mode: input.mode,
    responseDeadline: input.responseDeadline,
    location: input.location?.text || null,
    description: input.description || null,
    slots: input.slots.map((s) => ({
      date: s.date,
      time: isDateOnly || !s.time ? null : s.time.length === 5 ? `${s.time}:00` : s.time,
      label: s.label || null,
    })),
  };
}

export function createEvent(input: CreateEventInput): Promise<CreateEventResult> {
  return apiFetch<CreateEventResult>("/api/events/", {
    method: "POST",
    body: JSON.stringify(toCreateEventRequest(input)),
  });
}

// Client-side mirror of the POST /api/events/ constraints so the form can
// block obviously invalid input; the backend re-validates everything.
export const CREATE_EVENT_LIMITS = {
  title: 30,
  hostNickname: 40, // weighted: CJK / full-width characters count as 2
  location: 200,
  description: 50,
  maxSlots: 20,
};

export function weightedLength(text: string): number {
  let n = 0;
  // Matches the backend rule: unicodedata.east_asian_width in ("W", "F") counts as 2.
  for (const ch of text) n += /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1;
  return n;
}

// Returns the first problem with the form input, or null if it can be sent.
export function validateCreateEventInput(input: Pick<CreateEventInput, "hostName" | "slots" | "description">): string | null {
  const nickname = (input.hostName || "").trim();
  if (!nickname) return "請填寫主揪暱稱";
  if (weightedLength(nickname) > CREATE_EVENT_LIMITS.hostNickname) return "主揪暱稱過長（中文最多 20 字、英文最多 40 字）";
  if ((input.description || "").trim().length > CREATE_EVENT_LIMITS.description) return `活動說明最多 ${CREATE_EVENT_LIMITS.description} 字`;
  if (input.slots.length > CREATE_EVENT_LIMITS.maxSlots) return `候選時段最多 ${CREATE_EVENT_LIMITS.maxSlots} 個（目前 ${input.slots.length} 個）`;
  return null;
}
