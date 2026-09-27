import { describe, expect, it } from "vitest";
import { validateCreateEventInput, weightedLength } from "../api/eventsApi";

const slot = { date: "2026-10-03", time: "18:00", label: "" };
const valid = { hostName: "小明", description: "", slots: [slot] };

describe("weightedLength (matches backend east_asian_width rule)", () => {
  it("counts CJK and full-width characters as 2, others as 1", () => {
    expect(weightedLength("abc")).toBe(3);
    expect(weightedLength("小明")).toBe(4);
    expect(weightedLength("小明32")).toBe(6);
    expect(weightedLength("ＡＢ")).toBe(4);
  });
});

describe("validateCreateEventInput", () => {
  it("accepts a complete form", () => {
    expect(validateCreateEventInput(valid)).toBeNull();
  });

  it("requires a host nickname", () => {
    expect(validateCreateEventInput({ ...valid, hostName: "   " })).toBe("請填寫主揪暱稱");
  });

  it("allows 20 Chinese characters or 40 ASCII characters in the nickname, not more", () => {
    expect(validateCreateEventInput({ ...valid, hostName: "一".repeat(20) })).toBeNull();
    expect(validateCreateEventInput({ ...valid, hostName: "a".repeat(40) })).toBeNull();
    expect(validateCreateEventInput({ ...valid, hostName: "一".repeat(21) })).toBe("主揪暱稱過長（中文最多 20 字、英文最多 40 字）");
    expect(validateCreateEventInput({ ...valid, hostName: "a".repeat(41) })).toBe("主揪暱稱過長（中文最多 20 字、英文最多 40 字）");
  });

  it("limits the description to 50 characters", () => {
    expect(validateCreateEventInput({ ...valid, description: "說".repeat(50) })).toBeNull();
    expect(validateCreateEventInput({ ...valid, description: "說".repeat(51) })).toBe("活動說明最多 50 字");
  });

  it("limits candidate slots to 20", () => {
    expect(validateCreateEventInput({ ...valid, slots: Array(20).fill(slot) })).toBeNull();
    expect(validateCreateEventInput({ ...valid, slots: Array(21).fill(slot) })).toBe("候選時段最多 20 個（目前 21 個）");
  });
});
