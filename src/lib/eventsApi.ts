// Events module (模組01/03/07/10) against the real backend. The rest of the
// app still goes through ./api.ts (localStorage) until each endpoint is
// migrated.
import { ApiEvent, AvailabilityStatus, CreateEventInput, CreateEventRequest, CreateEventResult, EventComment, EventData, EventSummary, SubmitCommentInput, UpdateEventInput } from "../types";
import { apiFetch } from "./http";

export function listMyEvents(): Promise<EventSummary[]> {
  return apiFetch<EventSummary[]>("/api/events/?owner=me");
}

// The event page components compare a hostToken against event.hostToken to
// decide host UI. The backend has no host tokens — ownership comes from the
// logged-in account (isOwner) — so owner events get this fixed placeholder on
// both sides of that comparison.
export const API_OWNER_HOST_TOKEN = "__api_owner__";

// Adapts the backend Event to the EventData shape both UI trees render.
// Comments come from a separate endpoint (GET /api/events/{id}/comments/, not
// wired up yet), and the API has no createdAt/updatedAt on this payload.
export function fromApiEvent(e: ApiEvent): EventData & { isOwner: boolean } {
  return {
    id: e.id,
    hostToken: e.isOwner ? API_OWNER_HOST_TOKEN : "",
    title: e.title,
    description: e.description || undefined,
    location: e.location ? { text: e.location } : undefined,
    hostName: e.hostNickname,
    hostEmail: e.hostEmail || undefined,
    mode: e.mode,
    responseDeadline: e.responseDeadline,
    slots: e.slots.map((s) => ({
      id: s.id,
      date: s.date,
      time: s.time ? s.time.slice(0, 5) : "",
      label: s.label || undefined,
    })),
    responses: e.responses.map((r) => ({
      id: r.id,
      nickname: r.nickname,
      comment: r.comment || undefined,
      availability: Object.fromEntries(r.slotAvailabilities.map((a) => [a.slotId, a.availability])) as Record<string, AvailabilityStatus>,
      updatedAt: "",
    })),
    comments: [],
    status: e.status,
    finalSlotId: e.finalSlotId || undefined,
    finalNote: e.finalNote || undefined,
    createdAt: "",
    updatedAt: "",
    isOwner: e.isOwner,
  };
}

export async function getEvent(id: string): Promise<EventData & { isOwner: boolean }> {
  const data = await apiFetch<ApiEvent>(`/api/events/${encodeURIComponent(id)}/`, { optionalAuth: true });
  return fromApiEvent(data);
}

export type EditableEventFields = Omit<UpdateEventInput, "hostToken">;

// PATCH /api/events/{id}/ with only the fields that differ from `original`.
// Sending unchanged fields isn't harmless: the backend re-validates
// responseDeadline as "must be in the future", so echoing back an
// already-passed deadline would reject an edit that only touched the title.
export async function updateEvent<T extends EventData>(original: T, input: EditableEventFields): Promise<T | (EventData & { isOwner: boolean })> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined && input.title !== original.title) patch.title = input.title;

  const description = input.description || null;
  if (description !== (original.description || null)) patch.description = description;

  const location = input.location?.text || null;
  if (location !== (original.location?.text || null)) patch.location = location;

  if (input.hostName !== undefined && input.hostName !== (original.hostName || "")) patch.hostNickname = input.hostName;

  // The backend's hostEmail accepts neither "" nor null, so a cleared field
  // can't be sent — it just keeps the stored email.
  if (input.hostEmail && input.hostEmail !== original.hostEmail) patch.hostEmail = input.hostEmail;

  // Compared as instants: the form round-trips "…T23:59:00+08:00" to "…T15:59:00.000Z".
  if (input.responseDeadline && new Date(input.responseDeadline).getTime() !== new Date(original.responseDeadline).getTime()) {
    patch.responseDeadline = input.responseDeadline;
  }

  if (Object.keys(patch).length === 0) return original;

  const data = await apiFetch<ApiEvent>(`/api/events/${encodeURIComponent(original.id)}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return fromApiEvent(data);
}

// --- Host lifecycle actions (模組06). Each returns the full updated event. --- //

function eventActionPath(eventId: string, action: "finalize" | "reopen" | "cancel"): string {
  return `/api/events/${encodeURIComponent(eventId)}/${action}/`;
}

export async function finalizeEvent(eventId: string, input: { finalSlotId: string; finalNote?: string }): Promise<EventData & { isOwner: boolean }> {
  const data = await apiFetch<ApiEvent>(eventActionPath(eventId, "finalize"), {
    method: "POST",
    body: JSON.stringify({ finalSlotId: input.finalSlotId, finalNote: input.finalNote?.trim() || null }),
  });
  return fromApiEvent(data);
}

// Only for finalized events; the backend answers 409 EVENT_NOT_FINALIZED
// otherwise. The deadline must be in the future.
export async function reopenEvent(eventId: string, responseDeadline: string): Promise<EventData & { isOwner: boolean }> {
  const data = await apiFetch<ApiEvent>(eventActionPath(eventId, "reopen"), {
    method: "POST",
    body: JSON.stringify({ responseDeadline }),
  });
  return fromApiEvent(data);
}

// Works on active or finalized events. The backend soft-deletes every vote
// and clears the final slot, so the returned event has no responses.
export async function cancelEvent(eventId: string): Promise<EventData & { isOwner: boolean }> {
  const data = await apiFetch<ApiEvent>(eventActionPath(eventId, "cancel"), { method: "POST" });
  return fromApiEvent(data);
}

// --- Comments (模組09) --- //
// Reading and posting are public (no login, any nickname); only the host can
// delete. The event payload doesn't include comments, so they're fetched
// separately.

function commentsPath(eventId: string): string {
  return `/api/events/${encodeURIComponent(eventId)}/comments/`;
}

export interface CommentPage {
  comments: EventComment[]; // oldest first, ready to render top-to-bottom
  nextCursor: string | null; // pass back to load the next older page; null = no more
}

// The backend pages 10 at a time, newest first (swagger still documents the
// older "whole array, oldest first" shape — backend add-comment-pagination
// changed it). Each page is flipped to oldest first for the board.
export async function listComments(eventId: string, cursor?: string): Promise<CommentPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const page = await apiFetch<{ comments: EventComment[]; nextCursor: string | null }>(`${commentsPath(eventId)}${query}`, { optionalAuth: true });
  return { comments: [...page.comments].reverse(), nextCursor: page.nextCursor };
}

export function postComment(eventId: string, input: SubmitCommentInput): Promise<EventComment> {
  return apiFetch<EventComment>(commentsPath(eventId), {
    method: "POST",
    body: JSON.stringify({ nickname: input.nickname, message: input.message }),
    optionalAuth: true,
  });
}

export async function deleteComment(eventId: string, commentId: string): Promise<void> {
  await apiFetch<null>(`${commentsPath(eventId)}${encodeURIComponent(commentId)}/`, { method: "DELETE" });
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
