export type AvailabilityStatus = 'available' | 'if_needed' | 'unavailable';

export type EventMode = 'date_only' | 'time_slots';

export interface TimeSlot {
  id: string;
  date: string; // YYYY-MM-DD format e.g. "2026-08-15"
  time: string; // e.g. "18:00 - 21:00" or "午餐 12:00-14:00"
  label?: string; // Optional custom title e.g. "居酒屋小酌", "早午餐"
}

export interface ParticipantResponse {
  id: string;
  nickname: string;
  email?: string;
  password?: string; // 選填，明文防呆用途（非加密驗證），一旦設定不可修改
  availability: Record<string, AvailabilityStatus>; // slotId -> status
  comment?: string;
  updatedAt: string;
}

export interface EventComment {
  id: string;
  nickname: string;
  message: string;
  createdAt: string;
}

export interface EventLocation {
  text: string;   // 顯示用地點名稱
  url?: string;   // Google Maps 連結（若使用者貼的是連結）
}

export interface AiSelectedRestaurant {
  emoji: string;
  name: string;
  rating: number;
  priceLevel: string;
  address: string;
  mapsUrl: string;
  reason: string;
  selectedAt: string;
}

export interface EventData {
  id: string;
  hostToken: string; // Secret key generated for creator
  title: string;
  description?: string;
  location?: EventLocation;
  hostName?: string;
  hostEmail?: string;
  mode: EventMode;
  responseDeadline: string; // ISO datetime string — voting closes after this
  slots: TimeSlot[];
  responses: ParticipantResponse[];
  comments: EventComment[];
  status: 'active' | 'finalized' | 'cancelled';
  finalSlotId?: string;
  finalNote?: string;
  cancelledAt?: string;
  aiSelectedRestaurant?: AiSelectedRestaurant;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: EventLocation;
  hostName?: string;
  hostEmail?: string;
  mode: EventMode;
  responseDeadline: string;
  slots: Omit<TimeSlot, 'id'>[];
}

export interface SubmitResponseInput {
  participantId?: string; // If re-editing
  accessToken?: string; // Issued by response identity verification
  nickname: string;
  email?: string;
  password?: string;
  availability: Record<string, AvailabilityStatus>;
  comment?: string;
}

export interface FinalizeEventInput {
  hostToken: string;
  finalSlotId: string;
  finalNote?: string;
}

export interface SubmitCommentInput {
  nickname: string;
  message: string;
}

export interface CancelEventInput {
  hostToken: string;
}

export interface UpdateEventInput {
  hostToken: string;
  title?: string;
  description?: string;
  location?: EventLocation;
  hostName?: string;
  hostEmail?: string;
  responseDeadline?: string;
}

// "載入較早的留言" state for the comment board (backend pages comments).
export interface OlderCommentsControl {
  hasMore: boolean;
  isLoading: boolean;
  onLoad: () => void;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface SlotStats {
  slotId: string;
  slot: TimeSlot;
  availableCount: number;
  ifNeededCount: number;
  unavailableCount: number;
  availableNames: string[];
  ifNeededNames: string[];
  unavailableNames: string[];
  score: number; // e.g. available*2 + ifNeeded*1
  percentage: number; // percentage of total participants who are available
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

// --- Backend (jiu-sync API) shapes --- //

// Server-computed lifecycle label; the frontend renders it as-is instead of
// re-deriving it from status/responseDeadline.
export type DisplayStatus =
  | 'voting_open'
  | 'voting_closed_pending'
  | 'finalized_upcoming'
  | 'finalized_past'
  | 'cancelled'
  | 'link_expired';

export interface ApiSlot {
  id?: string;
  date: string; // YYYY-MM-DD
  time: string | null; // "HH:MM:SS"; null in date_only mode
  label: string | null;
}

// One row of GET /api/events/?owner=me ("我揪的團").
export interface EventSummary {
  id: string;
  title: string;
  hostNickname: string;
  mode: EventMode;
  responseDeadline: string;
  location: string | null;
  description: string | null;
  status: 'active' | 'finalized' | 'cancelled';
  displayStatus: DisplayStatus;
  isOwner: boolean;
  responseCount: number;
  slots?: ApiSlot[];
  finalSlotId?: string | null;
  finalNote?: string | null;
}

export interface CreateEventRequest {
  title: string;
  hostNickname: string;
  mode: EventMode;
  responseDeadline: string;
  location: string | null;
  description: string | null;
  slots: Omit<ApiSlot, 'id'>[];
}

export interface CreateEventResult {
  id: string;
  shareUrl: string;
}

export interface ApiSlotAvailability {
  slotId: string;
  availability: AvailabilityStatus;
}

export interface ApiParticipantResponse {
  id: string;
  nickname: string;
  comment: string | null;
  slotAvailabilities: ApiSlotAvailability[];
}

// GET /api/events/{id}/ — full event for the event page.
export interface ApiEvent extends Omit<EventSummary, 'responseCount' | 'slots'> {
  hostEmail: string | null;
  slots: (ApiSlot & { id: string })[];
  slotSummary: { slotId: string; available: number; if_needed: number; unavailable: number }[];
  responses: ApiParticipantResponse[];
  finalSlotId: string | null;
  finalNote: string | null;
  finalAttendees: { id: string; nickname: string; comment: string | null }[];
}
