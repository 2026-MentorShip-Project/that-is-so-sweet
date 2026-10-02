import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VoteTab } from "../components/app/VoteTab";
import { EventData } from "../types";

const event: EventData = {
  id: "host-vote-test", hostToken: "", title: "主揪投票測試", hostName: "活動主揪",
  mode: "date_only", status: "active", responseDeadline: "2099-12-31T23:59:59Z",
  slots: [{ id: "slot-a", date: "2099-12-30", time: "" }],
  responses: [], comments: [], createdAt: "", updatedAt: "",
};

function render(isHost: boolean, responses: EventData["responses"] = []) {
  return renderToStaticMarkup(<VoteTab
    event={{ ...event, responses }} isHost={isHost} nickname="帳號暱稱"
    setNickname={vi.fn()} email="" setEmail={vi.fn()} onSubmit={vi.fn()}
    isLoading={false} initialMode="create"
  />);
}

describe("host first vote", () => {
  it("uses the event host name immediately and locks only the nickname", () => {
    const html = render(true);
    const nicknameInput = html.match(/<input[^>]*value="活動主揪"[^>]*>/)?.[0];
    const phoneInput = html.match(/<input[^>]*placeholder="請輸入手機末三碼（例如：123）"[^>]*>/)?.[0];
    expect(html).toContain("主揪暱稱");
    expect(nicknameInput).toContain("disabled");
    expect(phoneInput).toBeDefined();
    expect(phoneInput).not.toContain("disabled");
    expect(phoneInput).toContain('value=""');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>送出我的時間/);
  });

  it("keeps other participants' nicknames editable", () => {
    const html = render(false);
    const nicknameInput = html.match(/<input[^>]*value="帳號暱稱"[^>]*>/)?.[0];
    expect(nicknameInput).toBeDefined();
    expect(nicknameInput).not.toContain("disabled");
    expect(html).toContain("您的暱稱");
  });

  it("checks existing votes using the host name rather than the account nickname", () => {
    const html = render(true, [{ id: "r1", nickname: "活動主揪", availability: {}, updatedAt: "" }]);
    expect(html).toContain("更新投票");
    expect(html).toContain("此暱稱已被使用");
  });
});
