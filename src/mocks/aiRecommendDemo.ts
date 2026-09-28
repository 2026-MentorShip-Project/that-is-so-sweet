// Option lists for the "AI 推薦餐廳" preference form (they match the backend's
// allowed values), plus the demo-only fake recommendation used by demo-*
// events. Real events call POST /api/events/{id}/restaurant-recommendations/;
// demo events get a hand-authored result in the same RecommendationResult
// shape, so both render through the same screens.
import { AiQuota, EventData, RecommendationResult, RecommendedRestaurant, ResolvedPreferences } from "../types";
import { PreferenceForm } from "../api/recommendationsApi";
import { getMonthlyAiUsage, recordAiUsage } from "./aiUsage";

export const RELATIONSHIP_OPTIONS = ["同事", "朋友", "家人", "社團", "約會"] as const;
export const BUDGET_OPTIONS = ["200 以下", "200-400", "400-600", "600-800", "800-1000", "1000 以上"] as const;
export const PARTY_SIZE_OPTIONS = ["2 人", "3-4 人", "5-8 人", "9 人以上（多人）", "20 人以上（團體）"] as const;
export const SITUATIONAL_OPTIONS = ["可久坐", "有插座", "停車位", "親子友善", "無障礙"] as const;
export const SPICE_OPTIONS = ["不吃辣", "愛吃辣"] as const;
// Quick picks only — the backend accepts any cuisine the host types.
export const CUISINE_OPTIONS = ["日式", "韓式", "美式", "義式", "泰式", "火鍋"] as const;

// Backend limits (add-ai-restaurant-recommendation spec).
export const PREFERENCE_LIMITS = {
  location: 100,
  customPrompt: 200,
  cuisines: 5,
  cuisineLength: 20,
  restrictions: 5,
  restrictionLength: 30,
};

// Same thresholds as the backend's party_size_for_count.
export function partySizeForCount(count: number): string {
  if (count <= 2) return "2 人";
  if (count <= 4) return "3-4 人";
  if (count <= 8) return "5-8 人";
  if (count <= 19) return "9 人以上（多人）";
  return "20 人以上（團體）";
}

export const emptyPreferenceForm: PreferenceForm = {
  location: "",
  relationship: null,
  budget: null,
  partySize: null,
  situational: [],
  vegetarian: false,
  spice: null,
  cuisines: [],
  restrictions: [],
  customPrompt: "",
};

// --- Demo-only fake recommendation --- //

const demoRestaurants: Omit<RecommendedRestaurant, "id">[] = [
  {
    name: "職人炭火燒肉",
    address: "台北市大安區忠孝東路四段 181 巷 40 弄 5 號",
    phone: "02-2711-0000",
    rating: 4.6,
    reviewCount: 1280,
    openingHours: "17:00–23:00",
    priceRange: null,
    avgPricePerPerson: { min: 600, max: 900 },
    cuisineType: "燒肉",
    distanceInfo: { transitPoint: "忠孝敦化站", walkMinutes: 4 },
    recommendReason: "有獨立包廂，適合多人聚餐",
    sourceUrl: null,
  },
  {
    name: "好時光義式餐酒館",
    address: "台北市中山區林森北路 107 巷 10 號",
    phone: null,
    rating: 4.5,
    reviewCount: 860,
    openingHours: "11:30–22:00",
    priceRange: null,
    avgPricePerPerson: { min: 500, max: 800 },
    cuisineType: "義式",
    distanceInfo: { transitPoint: "中山站", walkMinutes: 6 },
    recommendReason: "氣氛輕鬆，適合朋友聚會",
    sourceUrl: null,
  },
  {
    name: "山葵日式割烹",
    address: "台北市信義區松仁路 58 號 2 樓",
    phone: "02-2720-0000",
    rating: 4.7,
    reviewCount: 540,
    openingHours: "11:30–14:30、17:30–22:00",
    priceRange: null,
    avgPricePerPerson: { min: 800, max: 1200 },
    cuisineType: "日式",
    distanceInfo: { transitPoint: "市政府站", walkMinutes: 8 },
    recommendReason: "環境安靜，適合家人聚餐",
    sourceUrl: null,
  },
  {
    name: "花園野餐咖啡",
    address: "台北市內湖區成功路四段 168 號",
    phone: null,
    rating: 4.4,
    reviewCount: 320,
    openingHours: "10:00–20:00",
    priceRange: "$$",
    avgPricePerPerson: null,
    cuisineType: "複合式",
    distanceInfo: null,
    recommendReason: "有兒童椅與戶外空間，親子友善",
    sourceUrl: null,
  },
  {
    name: "深夜熱炒 48 號",
    address: "台北市萬華區西寧南路 48 號",
    phone: null,
    rating: 4.3,
    reviewCount: 2100,
    openingHours: "17:00–02:00",
    priceRange: null,
    avgPricePerPerson: { min: 250, max: 400 },
    cuisineType: "熱炒",
    distanceInfo: { transitPoint: "西門站", walkMinutes: 5 },
    recommendReason: "菜色多、價格實惠，適合熱鬧聚會",
    sourceUrl: null,
  },
];

export function demoQuota(): AiQuota {
  const { count, limit } = getMonthlyAiUsage();
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    limit,
    used: count,
    remaining: Math.max(limit - count, 0),
    available: count < limit,
    resetsAt: next.toISOString(),
    serviceAvailable: true,
  };
}

// Fake result in the real API's shape. `shuffle` only reorders — there is no
// real search behind a demo "重新推薦".
export function demoRecommendation(event: EventData, form: PreferenceForm, attendeeCount: number, shuffle = false): RecommendationResult {
  recordAiUsage();
  const finalSlot = event.slots.find((s) => s.id === event.finalSlotId);
  const list = demoRestaurants.map((r, i) => ({ ...r, id: `demo-r${i}` }));
  if (shuffle) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const location = form.location.trim() || event.location?.text || "台北車站";
  const resolved: ResolvedPreferences = {
    location,
    locationSource: form.location.trim() ? "request" : "event",
    partySize: form.partySize || (attendeeCount > 0 ? partySizeForCount(attendeeCount) : null),
    attendeeCount,
    mealDate: finalSlot?.date || new Date().toISOString().slice(0, 10),
    mealTime: finalSlot?.time || null,
    relationship: form.relationship,
    budget: form.budget,
    situational: form.situational,
    dietary: {
      vegetarian: form.vegetarian || null,
      spice: form.spice,
      cuisines: form.cuisines.map((c) => c.trim()).filter(Boolean),
      restrictions: form.restrictions.map((c) => c.trim()).filter(Boolean),
    },
    customPrompt: form.customPrompt.trim() || null,
  };
  return { id: `demo-${Date.now()}`, restaurants: list, notes: "這是示範資料，不是真的 AI 搜尋結果。", resolvedPreferences: resolved, quota: demoQuota() };
}
