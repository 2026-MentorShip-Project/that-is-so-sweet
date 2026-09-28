import { AiSelectedRestaurant, RecommendedRestaurant, ResolvedPreferences } from "../../types";
import { ApiError } from "../../api/http";

// "2026-10-03" → "10/3"
const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
};

// One-sentence restatement of what the backend actually searched with.
export function describeResolvedPreferences(p: ResolvedPreferences): string {
  const where = `在「${p.location}」${p.locationSource === "event" ? "（活動地點）" : ""}附近`;
  const when = p.mealTime ? `${shortDate(p.mealDate)} ${p.mealTime}` : shortDate(p.mealDate);
  const who = p.partySize ? ` 適合 ${p.attendeeCount > 0 ? `${p.attendeeCount} 人（${p.partySize}）` : p.partySize}` : " ";
  const base = `${where}，找 ${when}${who}的餐廳。`;

  const extras: string[] = [];
  if (p.relationship) extras.push(`${p.relationship}聚餐`);
  if (p.budget) extras.push(`每人 ${p.budget} 元`);
  if (p.dietary.vegetarian) extras.push("素食");
  if (p.dietary.spice) extras.push(p.dietary.spice);
  if (p.dietary.cuisines.length > 0) extras.push(p.dietary.cuisines.join("、"));
  if (p.dietary.restrictions.length > 0) extras.push(`避開${p.dietary.restrictions.join("、")}`);
  if (p.situational.length > 0) extras.push(p.situational.join("、"));
  if (p.customPrompt) extras.push(p.customPrompt);
  return extras.length > 0 ? `${base}${extras.join("・")}` : base;
}

export function formatPrice(r: RecommendedRestaurant): string | null {
  const avg = r.avgPricePerPerson;
  if (avg && avg.min !== null && avg.max !== null) return `每人 $${avg.min}–${avg.max}`;
  if (avg && avg.min !== null) return `每人 $${avg.min} 起`;
  if (avg && avg.max !== null) return `每人 $${avg.max} 以內`;
  return r.priceRange;
}

// A search link, not a claimed listing — the AI's result has no Maps place id.
export function mapsSearchUrl(name: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
}

export function toSelectedRestaurant(r: RecommendedRestaurant, selectedAt: string): AiSelectedRestaurant {
  return {
    emoji: "🍽️",
    name: r.name,
    rating: r.rating,
    priceLevel: formatPrice(r) ?? "",
    address: r.address,
    mapsUrl: mapsSearchUrl(r.name, r.address),
    reason: r.recommendReason ?? "",
    selectedAt,
  };
}

const MESSAGES: Record<string, string> = {
  LOCATION_REQUIRED: "請在上方填寫聚餐地點，活動本身沒有設定地點。",
  AI_RECOMMENDATION_QUOTA_EXCEEDED: "本月 AI 推薦次數已用完，下個月 1 日會重置。",
  EVENT_ALREADY_PAST: "聚會日期已過，無法再推薦餐廳。",
  AI_RECOMMENDATION_IN_PROGRESS: "這個活動已經有一筆推薦正在進行，請稍候再試。",
  AI_RECOMMENDATION_UNAVAILABLE: "AI 推薦服務目前未開放，請稍後再試。",
  AI_RECOMMENDATION_UPSTREAM_TIMEOUT: "AI 搜尋逾時，這次不會計入次數，請再試一次。",
  AI_RECOMMENDATION_UPSTREAM_FAILED: "AI 這次沒有找到合適的餐廳，這次不會計入次數，可以調整條件再試。",
};

export function aiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return (err.code && MESSAGES[err.code]) || err.displayMessage;
  return "AI 推薦失敗，請稍後再試。";
}
