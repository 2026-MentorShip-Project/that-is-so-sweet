import { describe, expect, it } from "vitest";
import { mergeLatestComments } from "../share/event/mergeLatestComments";
import { EventComment } from "../types";

const c = (id: string, minute: number): EventComment => ({
  id,
  nickname: id,
  message: id,
  createdAt: `2026-09-27T10:${String(minute).padStart(2, "0")}:00+08:00`,
});

describe("mergeLatestComments", () => {
  it("replaces everything when the latest page is the whole list", () => {
    const current = { comments: [c("a", 1), c("b", 2)], nextCursor: null };
    const latest = { comments: [c("a", 1), c("b", 2), c("new", 3)], nextCursor: null };

    expect(mergeLatestComments(current, latest)).toEqual(latest);
  });

  it("drops a comment the host deleted", () => {
    const current = { comments: [c("a", 1), c("b", 2), c("c", 3)], nextCursor: null };
    const latest = { comments: [c("a", 1), c("c", 3)], nextCursor: null };

    expect(mergeLatestComments(current, latest).comments.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("keeps older comments the user already loaded, and their cursor", () => {
    // User clicked 載入較早的留言, so old1/old2 are on screen and the cursor
    // points past them.
    const current = { comments: [c("old1", 1), c("old2", 2), c("p1", 10), c("p2", 11)], nextCursor: "cursor-past-old1" };
    const latest = { comments: [c("p1", 10), c("p2", 11), c("new", 12)], nextCursor: "cursor-past-p1" };

    expect(mergeLatestComments(current, latest)).toEqual({
      comments: [c("old1", 1), c("old2", 2), c("p1", 10), c("p2", 11), c("new", 12)],
      nextCursor: "cursor-past-old1",
    });
  });

  it("keeps a comment that a new one pushed out of the latest page, without reloading it", () => {
    // p1 no longer fits in the latest page but is still on screen; the old
    // cursor (past p1) stays so 載入較早的留言 won't fetch p1 twice.
    const current = { comments: [c("p1", 10), c("p2", 11)], nextCursor: "cursor-past-p1" };
    const latest = { comments: [c("p2", 11), c("new", 12)], nextCursor: "cursor-past-p2" };

    expect(mergeLatestComments(current, latest)).toEqual({
      comments: [c("p1", 10), c("p2", 11), c("new", 12)],
      nextCursor: "cursor-past-p1",
    });
  });

  it("uses the latest page as-is when nothing was on screen", () => {
    const latest = { comments: [c("a", 1)], nextCursor: "x" };
    expect(mergeLatestComments({ comments: [], nextCursor: null }, latest)).toEqual(latest);
  });
});
