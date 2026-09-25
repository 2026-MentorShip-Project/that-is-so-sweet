import { describe, expect, it } from "vitest";
import { getDisplayStatusInfo } from "./eventStatus";

describe("getDisplayStatusInfo", () => {
  it.each([
    ["voting_open", "active", "統計時間中", "active"],
    ["voting_closed_pending", "active", "投票已截止，待拍板", "active"],
    ["finalized_upcoming", "finalized", "已敲定，待舉辦", "finalized"],
    ["finalized_past", "finalized", "活動已結束", "finalized"],
    ["cancelled", "cancelled", "活動已取消", "cancelled"],
  ] as const)("%s → %s label, %s tab", (displayStatus, status, label, tab) => {
    const info = getDisplayStatusInfo({ displayStatus, status });
    expect(info.label).toBe(label);
    expect(info.tab).toBe(tab);
  });

  it("files an expired finalized event under 已敲定", () => {
    expect(getDisplayStatusInfo({ displayStatus: "link_expired", status: "finalized" })).toMatchObject({ label: "連結已失效", tab: "finalized" });
  });

  it("files an expired cancelled event under 已取消", () => {
    expect(getDisplayStatusInfo({ displayStatus: "link_expired", status: "cancelled" })).toMatchObject({ label: "連結已失效", tab: "cancelled" });
  });
});
