import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventDraftFields, clearEventDraft, formatDraftSavedAt, getEventDraft, saveEventDraft } from "./eventDraft";

const fields: EventDraftFields = {
  title: "週末聚餐",
  hostName: "小明",
  description: "想吃鍋物",
  mode: "time_slots",
  responseDeadline: "2026-10-02T23:59",
  selectedDates: ["2026-10-03", "2026-10-04"],
  slots: [{ date: "2026-10-03", time: "18:00", label: "晚餐" }],
  location: { text: "台北市信義區", url: "https://maps.app.goo.gl/abc" },
  locationInput: "台北市信義區",
};

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T08:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("event draft", () => {
  it("has no draft until something is saved", () => {
    expect(getEventDraft()).toBeNull();
  });

  it("restores every form field with the time it was saved", () => {
    saveEventDraft(fields);

    expect(getEventDraft()).toEqual({ ...fields, savedAt: "2026-09-25T08:30:00.000Z" });
  });

  it("keeps only the latest save", () => {
    saveEventDraft(fields);
    saveEventDraft({ ...fields, title: "改名了" });

    expect(getEventDraft()?.title).toBe("改名了");
  });

  it("is gone after clearing", () => {
    saveEventDraft(fields);
    clearEventDraft();

    expect(getEventDraft()).toBeNull();
  });

  it("treats a corrupted entry as no draft", () => {
    store.set("gathertime_event_draft", "{not json");

    expect(getEventDraft()).toBeNull();
  });

  it("does not break the form when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });

    expect(() => saveEventDraft(fields)).not.toThrow();
    expect(() => clearEventDraft()).not.toThrow();
    expect(getEventDraft()).toBeNull();
  });
});

describe("formatDraftSavedAt", () => {
  it("returns an empty string for an invalid timestamp", () => {
    expect(formatDraftSavedAt("not a date")).toBe("");
  });

  it("shows month/day and time", () => {
    expect(formatDraftSavedAt("2026-09-25T08:30:00.000Z")).toMatch(/9\/25/);
  });
});
