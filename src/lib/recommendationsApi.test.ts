import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAiQuota, requestRestaurantRecommendations, toRecommendationRequest } from "../api/recommendationsApi";
import { ApiError } from "../api/http";

let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init: init as RequestInit, headers: new Headers((init as RequestInit).headers) };
}

beforeEach(() => {
  vi.stubEnv("VITE_DEV_ACCESS_TOKEN", "");
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k === "jiu_access_token" ? "host-token" : null) });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const quota = {
  period: "2026-09",
  limit: 20,
  used: 3,
  remaining: 17,
  available: true,
  resetsAt: "2026-10-01T00:00:00+08:00",
  serviceAvailable: true,
};

describe("toRecommendationRequest", () => {
  const empty = {
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

  it("sends an empty body when nothing was filled in (略過)", () => {
    expect(toRecommendationRequest(empty)).toEqual({});
  });

  it("sends only filled fields, trimmed, with blank list items dropped", () => {
    expect(
      toRecommendationRequest({
        ...empty,
        location: "  中山站 ",
        relationship: "朋友",
        budget: "400-600",
        partySize: "5-8 人",
        situational: ["可久坐"],
        vegetarian: true,
        spice: "不吃辣",
        cuisines: ["日式", " 泰式 ", ""],
        restrictions: ["花生過敏", "  "],
        customPrompt: " 想要有包廂 ",
      })
    ).toEqual({
      location: "中山站",
      relationship: "朋友",
      budget: "400-600",
      partySize: "5-8 人",
      situational: ["可久坐"],
      dietary: { vegetarian: true, spice: "不吃辣", cuisines: ["日式", "泰式"], restrictions: ["花生過敏"] },
      customPrompt: "想要有包廂",
    });
  });

  it("omits dietary entirely when no dietary preference was chosen", () => {
    expect(toRecommendationRequest({ ...empty, budget: "200 以下" })).toEqual({ budget: "200 以下" });
  });
});

describe("getAiQuota", () => {
  it("GETs the logged-in host's monthly quota", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, quota));

    expect(await getAiQuota()).toEqual(quota);
    const { url, headers } = lastRequest();
    expect(url).toBe("http://localhost:8000/api/me/ai-recommendation-quota/");
    expect(headers.get("Authorization")).toBe("Bearer host-token");
  });
});

describe("requestRestaurantRecommendations", () => {
  const result = {
    id: "rec1",
    restaurants: [{ id: "r0", name: "鼎泰豐", address: "台北市信義區松高路19號" }],
    notes: null,
    resolvedPreferences: { location: "中山站", locationSource: "request" },
    quota: { ...quota, used: 4, remaining: 16 },
  };

  it("POSTs the preferences for the event as the host and returns the result", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, result));

    const res = await requestRestaurantRecommendations("J0Jf70hd", { location: "中山站" });

    const { url, init, headers } = lastRequest();
    expect(url).toBe("http://localhost:8000/api/events/J0Jf70hd/restaurant-recommendations/");
    expect(init.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer host-token");
    expect(JSON.parse(init.body as string)).toEqual({ location: "中山站" });
    expect(res).toEqual(result);
  });

  it("keeps the backend's code and notes when nothing usable was found", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(502, { message: "AI 暫時無法提供推薦", code: "AI_RECOMMENDATION_UPSTREAM_FAILED", notes: "附近找不到符合素食條件的餐廳" })
    );

    const err = await requestRestaurantRecommendations("J0Jf70hd", {}).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("AI_RECOMMENDATION_UPSTREAM_FAILED");
    expect(err.notes).toBe("附近找不到符合素食條件的餐廳");
  });
});
