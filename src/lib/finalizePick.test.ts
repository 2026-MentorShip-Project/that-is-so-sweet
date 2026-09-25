import { describe, expect, it } from "vitest";
import { computeSlotStats } from "./slots";
import { defaultFinalSlotId, finalizeWarning } from "./finalizePick";
import { ParticipantResponse, TimeSlot } from "../types";

const slots: TimeSlot[] = [
  { id: "a", date: "2026-10-10", time: "18:00" },
  { id: "b", date: "2026-10-11", time: "19:00" },
  { id: "c", date: "2026-10-12", time: "12:00" },
];
const vote = (id: string, availability: ParticipantResponse["availability"]): ParticipantResponse => ({ id, nickname: id, availability, updatedAt: "" });

describe("defaultFinalSlotId", () => {
  it("pre-selects the slot most people can attend", () => {
    const stats = computeSlotStats(slots, [
      vote("r1", { a: "if_needed", b: "available", c: "unavailable" }),
      vote("r2", { a: "unavailable", b: "available", c: "if_needed" }),
    ]);
    expect(defaultFinalSlotId(stats)).toBe("b");
  });

  it("pre-selects nothing when nobody has voted, so the host must pick explicitly", () => {
    expect(defaultFinalSlotId(computeSlotStats(slots, []))).toBeUndefined();
  });

  it("pre-selects nothing when every vote is 不行", () => {
    const stats = computeSlotStats(slots, [vote("r1", { a: "unavailable", b: "unavailable", c: "unavailable" })]);
    expect(defaultFinalSlotId(stats)).toBeUndefined();
  });
});

describe("finalizeWarning", () => {
  it("warns when nobody has voted yet", () => {
    expect(finalizeWarning(computeSlotStats(slots, []), "a")).toBe("目前還沒有人投票，確定要直接定案嗎？");
  });

  it("warns when nobody can make the chosen slot", () => {
    const stats = computeSlotStats(slots, [vote("r1", { a: "unavailable", b: "available", c: "unavailable" })]);
    expect(finalizeWarning(stats, "a")).toBe("這個時段目前沒有人表示可以出席，確定要定案嗎？");
  });

  it("has no warning when someone can make the chosen slot", () => {
    const stats = computeSlotStats(slots, [vote("r1", { a: "if_needed", b: "available", c: "unavailable" })]);
    expect(finalizeWarning(stats, "a")).toBeNull();
    expect(finalizeWarning(stats, "b")).toBeNull();
  });
});
