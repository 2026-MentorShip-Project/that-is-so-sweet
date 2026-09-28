import { AiQuota, RecommendationRequest, RecommendationResult } from "../types";
import { ApiError, apiFetch } from "./http";

// The preference form's state. Every field is optional for the backend.
export interface PreferenceForm {
  location: string;
  relationship: string | null;
  budget: string | null;
  partySize: string | null;
  situational: string[];
  vegetarian: boolean;
  spice: string | null;
  cuisines: string[];
  restrictions: string[];
  customPrompt: string;
}

const cleanList = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);

// Only filled-in fields are sent; the backend fills the rest from the event
// (location, attending count, finalized slot), so an empty body is valid.
export function toRecommendationRequest(form: PreferenceForm): RecommendationRequest {
  const req: RecommendationRequest = {};
  const location = form.location.trim();
  if (location) req.location = location;
  if (form.relationship) req.relationship = form.relationship;
  if (form.budget) req.budget = form.budget;
  if (form.partySize) req.partySize = form.partySize;
  if (form.situational.length > 0) req.situational = form.situational;

  const dietary: NonNullable<RecommendationRequest["dietary"]> = {};
  if (form.vegetarian) dietary.vegetarian = true;
  if (form.spice) dietary.spice = form.spice;
  const cuisines = cleanList(form.cuisines);
  if (cuisines.length > 0) dietary.cuisines = cuisines;
  const restrictions = cleanList(form.restrictions);
  if (restrictions.length > 0) dietary.restrictions = restrictions;
  if (Object.keys(dietary).length > 0) req.dietary = dietary;

  const customPrompt = form.customPrompt.trim();
  if (customPrompt) req.customPrompt = customPrompt;
  return req;
}

export function getAiQuota(): Promise<AiQuota> {
  return apiFetch<AiQuota>("/api/me/ai-recommendation-quota/");
}

// When the AI found nothing usable, the 502 body also carries the AI's own
// explanation in `notes`.
export class RecommendationError extends ApiError {
  notes: string | null;

  constructor(err: ApiError) {
    super(err.status, err.message, err.code, err.errors, err.body);
    const body = err.body as { notes?: unknown } | null;
    this.notes = typeof body?.notes === "string" ? body.notes : null;
  }
}

// Synchronous on the backend and can take tens of seconds.
export async function requestRestaurantRecommendations(eventId: string, request: RecommendationRequest): Promise<RecommendationResult> {
  try {
    return await apiFetch<RecommendationResult>(`/api/events/${encodeURIComponent(eventId)}/restaurant-recommendations/`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  } catch (err) {
    throw err instanceof ApiError ? new RecommendationError(err) : err;
  }
}
