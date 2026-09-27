import { EventLocation, EventMode, TimeSlot } from "../../types";

// 主揪創建活動填到一半、還沒送出前的草稿，存在這支 localStorage key。跟
// gathertime_events_db（已建立的活動）是不同東西——這裡只有「表單填了什麼」，
// 沒有 id/hostToken，送出成功前活動根本還不存在。只有一份草稿（單一 key，
// 不分裝置/分頁），送出成功後清空；填到一半離開不會清空，下次打開建立活動
// 表單時可以選擇繼續編輯或捨棄重填。

const LOCAL_EVENT_DRAFT_KEY = "gathertime_event_draft";

export interface EventDraftFields {
  title: string;
  hostName: string;
  description: string;
  mode: EventMode;
  responseDeadline: string; // datetime-local input value（本地時間字串，非 ISO）
  selectedDates: string[];
  slots: Omit<TimeSlot, "id">[];
  location: EventLocation | undefined;
  locationInput: string;
}

export interface EventDraft extends EventDraftFields {
  savedAt: string; // ISO，供「最後編輯於」顯示用
}

export function getEventDraft(): EventDraft | null {
  try {
    const raw = localStorage.getItem(LOCAL_EVENT_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as EventDraft) : null;
  } catch {
    return null;
  }
}

export function saveEventDraft(fields: EventDraftFields) {
  try {
    const draft: EventDraft = { ...fields, savedAt: new Date().toISOString() };
    localStorage.setItem(LOCAL_EVENT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage 不可用（無痕模式／容量滿）時靜默放棄，不影響表單本身可用性
  }
}

export function clearEventDraft() {
  try {
    localStorage.removeItem(LOCAL_EVENT_DRAFT_KEY);
  } catch {}
}

export function formatDraftSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Baseline marker for a form that was filled from an old draft: such a form
// is always saved on leave, never compared against the blank defaults.
export const DRAFT_RESTORED = "__restored__";

export interface LeaveDraftState {
  hasPendingDraft: boolean; // old draft shown, host hasn't picked resume/discard
  submitted: boolean; // event was created successfully
  baseline: string | null; // settled initial form (JSON), null until settled
  snapshot: string; // current form (JSON)
}

// What to do with the draft when the host leaves the create page or closes
// the browser. The draft is written only at that moment — not while typing
// and not on a failed submit, where the form simply keeps its contents.
export function draftActionOnLeave(s: LeaveDraftState): "save" | "clear" | "skip" {
  if (s.hasPendingDraft || s.submitted || s.baseline === null) return "skip";
  // A restored draft's baseline is DRAFT_RESTORED, which no form snapshot equals.
  if (s.snapshot === s.baseline) return "clear";
  return "save";
}
