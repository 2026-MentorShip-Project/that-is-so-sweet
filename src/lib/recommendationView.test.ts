import { describe, expect, it } from "vitest";
import { aiErrorMessage, describeResolvedPreferences, formatPrice, mapsSearchUrl, toSelectedRestaurant } from "../share/ai/recommendationView";
import { ApiError } from "../api/http";
import { RecommendedRestaurant, ResolvedPreferences } from "../types";

const resolved: ResolvedPreferences = {
  location: "中山站",
  locationSource: "request",
  partySize: "5-8 人",
  attendeeCount: 6,
  mealDate: "2026-10-03",
  mealTime: "18:00",
  relationship: null,
  budget: null,
  situational: [],
  dietary: { vegetarian: null, spice: null, cuisines: [], restrictions: [] },
  customPrompt: null,
};

const restaurant: RecommendedRestaurant = {
  id: "r0",
  name: "鼎泰豐 南西店",
  address: "台北市中山區南京西路12號",
  phone: "02-2523-6565",
  rating: 4.6,
  reviewCount: 3200,
  openingHours: "11:00–21:00",
  priceRange: null,
  avgPricePerPerson: { min: 400, max: 600 },
  cuisineType: "台菜",
  distanceInfo: { transitPoint: "中山站", walkMinutes: 3 },
  recommendReason: "包廂適合 6 人聚餐",
  sourceUrl: "https://example.com/article",
};

describe("describeResolvedPreferences", () => {
  it("restates the minimum the backend always fills in", () => {
    expect(describeResolvedPreferences(resolved)).toBe("在「中山站」附近，找 10/3 18:00 適合 6 人（5-8 人）的餐廳。");
  });

  it("marks a location taken from the event and skips an empty headcount", () => {
    expect(describeResolvedPreferences({ ...resolved, locationSource: "event", partySize: null, attendeeCount: 0, mealTime: null })).toBe(
      "在「中山站」（活動地點）附近，找 10/3 的餐廳。"
    );
  });

  it("includes every chosen condition", () => {
    expect(
      describeResolvedPreferences({
        ...resolved,
        relationship: "朋友",
        budget: "400-600",
        situational: ["可久坐", "有插座"],
        dietary: { vegetarian: true, spice: "不吃辣", cuisines: ["日式", "泰式"], restrictions: ["花生過敏"] },
        customPrompt: "想要有包廂",
      })
    ).toBe(
      "在「中山站」附近，找 10/3 18:00 適合 6 人（5-8 人）的餐廳。朋友聚餐・每人 400-600 元・素食・不吃辣・日式、泰式・避開花生過敏・可久坐、有插座・想要有包廂"
    );
  });
});

describe("formatPrice", () => {
  it("prefers the per-person range", () => {
    expect(formatPrice(restaurant)).toBe("每人 $400–600");
    expect(formatPrice({ ...restaurant, avgPricePerPerson: { min: 300, max: null } })).toBe("每人 $300 起");
  });

  it("falls back to the price range text, then nothing", () => {
    expect(formatPrice({ ...restaurant, avgPricePerPerson: null, priceRange: "$$" })).toBe("$$");
    expect(formatPrice({ ...restaurant, avgPricePerPerson: null, priceRange: null })).toBeNull();
  });
});

describe("mapsSearchUrl", () => {
  it("searches Google Maps by name and address", () => {
    expect(mapsSearchUrl("鼎泰豐", "台北市")).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E9%BC%8E%E6%B3%B0%E8%B1%90%20%E5%8F%B0%E5%8C%97%E5%B8%82"
    );
  });
});

describe("toSelectedRestaurant", () => {
  it("keeps what the finalized view shows", () => {
    expect(toSelectedRestaurant(restaurant, "2026-09-28T12:00:00.000Z")).toEqual({
      emoji: "🍽️",
      name: "鼎泰豐 南西店",
      rating: 4.6,
      priceLevel: "每人 $400–600",
      address: "台北市中山區南京西路12號",
      mapsUrl: mapsSearchUrl("鼎泰豐 南西店", "台北市中山區南京西路12號"),
      reason: "包廂適合 6 人聚餐",
      selectedAt: "2026-09-28T12:00:00.000Z",
    });
  });
});

describe("aiErrorMessage", () => {
  const err = (status: number, code: string) => new ApiError(status, "後端訊息", code);

  it("explains each backend code in plain words", () => {
    expect(aiErrorMessage(err(400, "LOCATION_REQUIRED"))).toBe("請在上方填寫聚餐地點，活動本身沒有設定地點。");
    expect(aiErrorMessage(err(403, "AI_RECOMMENDATION_QUOTA_EXCEEDED"))).toBe("本月 AI 推薦次數已用完，下個月 1 日會重置。");
    expect(aiErrorMessage(err(409, "EVENT_ALREADY_PAST"))).toBe("聚會日期已過，無法再推薦餐廳。");
    expect(aiErrorMessage(err(409, "AI_RECOMMENDATION_IN_PROGRESS"))).toBe("這個活動已經有一筆推薦正在進行，請稍候再試。");
    expect(aiErrorMessage(err(503, "AI_RECOMMENDATION_UNAVAILABLE"))).toBe("AI 推薦服務目前未開放，請稍後再試。");
    expect(aiErrorMessage(err(504, "AI_RECOMMENDATION_UPSTREAM_TIMEOUT"))).toBe("AI 搜尋逾時，這次不會計入次數，請再試一次。");
    expect(aiErrorMessage(err(502, "AI_RECOMMENDATION_UPSTREAM_FAILED"))).toBe("AI 這次沒有找到合適的餐廳，這次不會計入次數，可以調整條件再試。");
  });

  it("falls back to the backend message for anything else", () => {
    expect(aiErrorMessage(err(409, "EVENT_NOT_FINALIZED"))).toBe("後端訊息");
    expect(aiErrorMessage(new Error("boom"))).toBe("AI 推薦失敗，請稍後再試。");
  });
});
