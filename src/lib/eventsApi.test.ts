import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, getEvent, listMyEvents, updateEvent, finalizeEvent, reopenEvent, fromApiEvent, API_OWNER_HOST_TOKEN } from "./eventsApi";
import { ApiError } from "./http";
import { CreateEventInput } from "../types";

// Only the network (global fetch) and browser storage are stubbed — the
// modules under test run for real.

let storedToken: string | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function lastRequest(): { url: string; init: RequestInit; headers: Headers } {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url, init, headers: new Headers(init.headers) };
}

beforeEach(() => {
  storedToken = "valid-token";
  vi.stubEnv("VITE_DEV_ACCESS_TOKEN", "");
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k === "jiu_access_token" ? storedToken : null) });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("listMyEvents", () => {
  it("requests the logged-in host's events with a Bearer token", async () => {
    const rows = [{ id: "irt9DIwH", title: "週末聚餐揪團", displayStatus: "voting_closed_pending", isOwner: true }];
    fetchMock.mockResolvedValue(jsonResponse(200, rows));

    const result = await listMyEvents();

    const { url, headers } = lastRequest();
    expect(url).toBe("http://localhost:8000/api/events/?owner=me");
    expect(headers.get("Authorization")).toBe("Bearer valid-token");
    expect(result).toEqual(rows);
  });
});

describe("listMyEvents errors", () => {
  it("surfaces the backend message when the token is rejected", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: "驗證失敗，請重新登入", code: "UNAUTHORIZED" }));

    const err = await listMyEvents().catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.displayMessage).toBe("驗證失敗，請重新登入");
  });

  it("tells the user to log in when no token is configured", async () => {
    storedToken = null;
    fetchMock.mockResolvedValue(jsonResponse(401, { message: "驗證失敗，請重新登入", code: "UNAUTHORIZED" }));

    const err = await listMyEvents().catch((e) => e);

    expect(lastRequest().headers.has("Authorization")).toBe(false);
    expect(err.displayMessage).toBe("尚未設定 access token，請先登入");
  });

  it("reports an unreachable backend", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const err = await listMyEvents().catch((e) => e);

    expect(err.status).toBe(0);
    expect(err.displayMessage).toBe("無法連線到伺服器，請確認後端是否已啟動");
  });
});

const baseInput: CreateEventInput = {
  title: "嗨",
  hostName: "小明32",
  hostEmail: "host@example.com",
  mode: "time_slots",
  responseDeadline: "2026-09-30T15:59:00.000Z",
  location: { text: "台北市信義區", url: "https://maps.app.goo.gl/abc" },
  description: "大家投票選個時間吃飯",
  slots: [
    { date: "2026-09-25", time: "18:00", label: "週一晚上" },
    { date: "2026-09-25", time: "19:00", label: "" },
  ],
};

describe("createEvent", () => {
  it("POSTs the backend request body and returns the share link", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "ayQNb8TK", shareUrl: "https://thisissosweetofficial.vercel.app/events/ayQNb8TK" }));

    const result = await createEvent(baseInput);

    const { url, init, headers } = lastRequest();
    expect(url).toBe("http://localhost:8000/api/events/");
    expect(init.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer valid-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      title: "嗨",
      hostNickname: "小明32",
      mode: "time_slots",
      responseDeadline: "2026-09-30T15:59:00.000Z",
      location: "台北市信義區",
      description: "大家投票選個時間吃飯",
      slots: [
        { date: "2026-09-25", time: "18:00:00", label: "週一晚上" },
        { date: "2026-09-25", time: "19:00:00", label: null },
      ],
    });
    expect(result).toEqual({ id: "ayQNb8TK", shareUrl: "https://thisissosweetofficial.vercel.app/events/ayQNb8TK" });
  });

  it("sends null time for date-only events and null for empty optional fields", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "x", shareUrl: "u" }));

    await createEvent({
      ...baseInput,
      mode: "date_only",
      location: undefined,
      description: "",
      slots: [{ date: "2026-10-03", time: "", label: "" }],
    });

    const body = JSON.parse(lastRequest().init.body as string);
    expect(body.slots).toEqual([{ date: "2026-10-03", time: null, label: null }]);
    expect(body.location).toBeNull();
    expect(body.description).toBeNull();
  });

  it("joins per-field validation errors into one message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        message: "此欄位不可為空白。",
        code: "blank",
        errors: [
          { field: "slots", code: "SLOTS_REQUIRED", message: "候選時段至少須有 1 筆" },
          { field: "responseDeadline", code: "DEADLINE_IN_PAST", message: "投票截止時間必須晚於目前時間" },
        ],
      })
    );

    const err = await createEvent(baseInput).catch((e) => e);

    expect(err.status).toBe(400);
    expect(err.errors.map((e: { code: string }) => e.code)).toEqual(["SLOTS_REQUIRED", "DEADLINE_IN_PAST"]);
    expect(err.displayMessage).toBe("候選時段至少須有 1 筆；投票截止時間必須晚於目前時間");
  });
});

// Shape taken from a real GET /api/events/irt9DIwH/ response.
const apiEvent = {
  id: "irt9DIwH",
  title: "週末聚餐揪團",
  hostNickname: "小明",
  hostEmail: "host@example.com",
  mode: "time_slots",
  responseDeadline: "2026-09-20T23:59:00+08:00",
  location: "台北市信義區",
  description: "大家投票選個時間吃飯",
  status: "active",
  displayStatus: "voting_closed_pending",
  isOwner: true,
  slots: [
    { id: "slot-a", date: "2026-09-21", time: "18:00:00", label: "週一晚上" },
    { id: "slot-b", date: "2026-09-22", time: "19:00:00", label: null },
  ],
  slotSummary: [],
  responses: [
    {
      id: "resp1",
      nickname: "阿傑",
      comment: "19:00 才能到",
      slotAvailabilities: [
        { slotId: "slot-a", availability: "available" },
        { slotId: "slot-b", availability: "if_needed" },
      ],
    },
  ],
  finalSlotId: null,
  finalNote: null,
  finalAttendees: [],
};

describe("getEvent", () => {
  it("adapts the backend event to what the event page renders", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, apiEvent));

    const event = await getEvent("irt9DIwH");

    expect(lastRequest().url).toBe("http://localhost:8000/api/events/irt9DIwH/");
    expect(event).toMatchObject({
      id: "irt9DIwH",
      title: "週末聚餐揪團",
      hostName: "小明",
      location: { text: "台北市信義區" },
      status: "active",
      slots: [
        { id: "slot-a", date: "2026-09-21", time: "18:00", label: "週一晚上" },
        { id: "slot-b", date: "2026-09-22", time: "19:00", label: undefined },
      ],
      responses: [{ id: "resp1", nickname: "阿傑", comment: "19:00 才能到", availability: { "slot-a": "available", "slot-b": "if_needed" } }],
      comments: [],
      finalSlotId: undefined,
    });
  });

  it("marks the owner so the event page shows host controls", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, apiEvent));

    const event = await getEvent("irt9DIwH");

    expect(event.isOwner).toBe(true);
    expect(event.hostToken).toBe(API_OWNER_HOST_TOKEN);
  });

  it("gives non-owners no host token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...apiEvent, isOwner: false, hostEmail: null }));

    const event = await getEvent("irt9DIwH");

    expect(event.isOwner).toBe(false);
    expect(event.hostToken).not.toBe(API_OWNER_HOST_TOKEN);
  });

  it("uses an empty time for date-only slots", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...apiEvent, mode: "date_only", slots: [{ id: "d1", date: "2026-10-03", time: null, label: null }] }));

    const event = await getEvent("irt9DIwH");

    expect(event.slots).toEqual([{ id: "d1", date: "2026-10-03", time: "", label: undefined }]);
  });

  it("retries anonymously when a stale token is rejected, so participants can still open the link", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: "驗證失敗，請重新登入", code: "UNAUTHORIZED" }))
      .mockResolvedValueOnce(jsonResponse(200, { ...apiEvent, isOwner: false }));

    const event = await getEvent("irt9DIwH");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer valid-token");
    expect(new Headers(fetchMock.mock.calls[1][1].headers).has("Authorization")).toBe(false);
    expect(event.isOwner).toBe(false);
  });

  it("surfaces not-found and expired-link messages from the backend", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "找不到此活動，可能已被刪除或網址錯誤", code: "EVENT_NOT_FOUND" }));
    const notFound = await getEvent("zzzzzzzz").catch((e) => e);
    expect(notFound.status).toBe(404);
    expect(notFound.displayMessage).toBe("找不到此活動，可能已被刪除或網址錯誤");

    fetchMock.mockResolvedValueOnce(jsonResponse(410, { message: "此活動連結已失效（活動結束超過7天）", code: "LINK_EXPIRED" }));
    const expired = await getEvent("WpHm5SPO").catch((e) => e);
    expect(expired.status).toBe(410);
    expect(expired.code).toBe("LINK_EXPIRED");
  });
});

describe("updateEvent", () => {
  const original = fromApiEvent(apiEvent as never);
  const unchanged = {
    title: "週末聚餐揪團",
    description: "大家投票選個時間吃飯",
    location: { text: "台北市信義區" },
    hostName: "小明",
    hostEmail: "host@example.com",
    responseDeadline: "2026-09-20T15:59:00.000Z", // same instant as original
  };

  it("PATCHes only the fields the host changed and returns the updated event", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...apiEvent, title: "改過的標題" }));

    const updated = await updateEvent(original, { ...unchanged, title: "改過的標題" });

    const { url, init, headers } = lastRequest();
    expect(url).toBe("http://localhost:8000/api/events/irt9DIwH/");
    expect(init.method).toBe("PATCH");
    expect(headers.get("Authorization")).toBe("Bearer valid-token");
    // The past deadline is left out — resending it would fail DEADLINE_IN_PAST.
    expect(JSON.parse(init.body as string)).toEqual({ title: "改過的標題" });
    expect(updated.title).toBe("改過的標題");
    expect(updated.isOwner).toBe(true);
  });

  it("sends null when the host clears the description or location", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...apiEvent, description: null, location: null }));

    await updateEvent(original, { ...unchanged, description: "", location: undefined });

    expect(JSON.parse(lastRequest().init.body as string)).toEqual({ description: null, location: null });
  });

  it("sends a changed nickname, email and deadline", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, apiEvent));

    await updateEvent(original, { ...unchanged, hostName: "阿傑", hostEmail: "new@example.com", responseDeadline: "2026-10-01T15:59:00.000Z" });

    expect(JSON.parse(lastRequest().init.body as string)).toEqual({
      hostNickname: "阿傑",
      hostEmail: "new@example.com",
      responseDeadline: "2026-10-01T15:59:00.000Z",
    });
  });

  it("leaves hostEmail out when cleared, since the backend rejects blank or null emails", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, apiEvent));

    await updateEvent(original, { ...unchanged, title: "新標題", hostEmail: "" });

    expect(JSON.parse(lastRequest().init.body as string)).toEqual({ title: "新標題" });
  });

  it("skips the request when nothing changed", async () => {
    const result = await updateEvent(original, unchanged);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual(original);
  });

  it("surfaces why the backend refused the edit", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { message: "活動已定案或取消，無法編輯", code: "EVENT_NOT_ACTIVE" }));
    const notActive = await updateEvent(original, { ...unchanged, title: "新標題" }).catch((e) => e);
    expect(notActive.status).toBe(409);
    expect(notActive.displayMessage).toBe("活動已定案或取消，無法編輯");

    fetchMock.mockResolvedValueOnce(jsonResponse(403, { message: "僅活動擁有者可編輯此活動", code: "FORBIDDEN" }));
    const forbidden = await updateEvent(original, { ...unchanged, title: "新標題" }).catch((e) => e);
    expect(forbidden.status).toBe(403);
    expect(forbidden.displayMessage).toBe("僅活動擁有者可編輯此活動");
  });
});

describe("finalizeEvent", () => {
  it("POSTs the chosen slot and note, and returns the finalized event", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ...apiEvent, status: "finalized", displayStatus: "finalized_upcoming", finalSlotId: "slot-a", finalNote: "地點入口見，記得帶睡袋！" })
    );

    const event = await finalizeEvent("irt9DIwH", { finalSlotId: "slot-a", finalNote: "地點入口見，記得帶睡袋！" });

    const { url, init, headers } = lastRequest();
    expect(url).toBe("http://localhost:8000/api/events/irt9DIwH/finalize/");
    expect(init.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer valid-token");
    expect(JSON.parse(init.body as string)).toEqual({ finalSlotId: "slot-a", finalNote: "地點入口見，記得帶睡袋！" });
    expect(event).toMatchObject({ status: "finalized", finalSlotId: "slot-a", finalNote: "地點入口見，記得帶睡袋！", isOwner: true });
  });

  it("sends null when the host leaves no note", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...apiEvent, status: "finalized", finalSlotId: "slot-a" }));

    await finalizeEvent("irt9DIwH", { finalSlotId: "slot-a", finalNote: "  " });

    expect(JSON.parse(lastRequest().init.body as string)).toEqual({ finalSlotId: "slot-a", finalNote: null });
  });

  it("surfaces why the backend refused", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { message: "活動已取消，無法定案", code: "EVENT_ALREADY_CANCELLED" }));

    const err = await finalizeEvent("irt9DIwH", { finalSlotId: "slot-a" }).catch((e) => e);

    expect(err.status).toBe(409);
    expect(err.displayMessage).toBe("活動已取消，無法定案");
  });
});

describe("reopenEvent", () => {
  it("POSTs the new deadline and returns the event back in voting", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...apiEvent, status: "active", displayStatus: "voting_open", responseDeadline: "2026-10-05T15:59:00+00:00" }));

    const event = await reopenEvent("irt9DIwH", "2026-10-05T15:59:00.000Z");

    const { url, init } = lastRequest();
    expect(url).toBe("http://localhost:8000/api/events/irt9DIwH/reopen/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ responseDeadline: "2026-10-05T15:59:00.000Z" });
    expect(event).toMatchObject({ status: "active", finalSlotId: undefined, responseDeadline: "2026-10-05T15:59:00+00:00" });
  });

  it("surfaces why the backend refused", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { message: "活動目前不是已定案狀態，無法重新開放投票", code: "EVENT_NOT_FINALIZED" }));

    const err = await reopenEvent("irt9DIwH", "2026-10-05T15:59:00.000Z").catch((e) => e);

    expect(err.code).toBe("EVENT_NOT_FINALIZED");
    expect(err.displayMessage).toBe("活動目前不是已定案狀態，無法重新開放投票");
  });
});

