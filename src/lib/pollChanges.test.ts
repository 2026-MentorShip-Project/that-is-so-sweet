import { describe, expect, it } from "vitest";
import { pollChanges } from "../share/event/pollChanges";
import { EventPollStatus } from "../types";

const base: EventPollStatus = {
  status: "active",
  displayStatus: "voting_open",
  eventUpdatedAt: "2026-09-25T10:00:00+08:00",
  responseCount: 2,
  latestResponseAt: "2026-09-25T09:50:00+08:00",
  commentCount: 3,
  latestCommentAt: "2026-09-25T09:55:00+08:00",
};

describe("pollChanges", () => {
  it("reports nothing when nothing changed", () => {
    expect(pollChanges(base, { ...base })).toEqual({ event: false, comments: false });
  });

  it("flags the event when the event itself changed", () => {
    expect(pollChanges(base, { ...base, eventUpdatedAt: "2026-09-25T10:05:00+08:00" })).toEqual({ event: true, comments: false });
    expect(pollChanges(base, { ...base, status: "finalized", displayStatus: "finalized_upcoming" })).toEqual({ event: true, comments: false });
    // The deadline passing flips displayStatus without any write to the event.
    expect(pollChanges(base, { ...base, displayStatus: "voting_closed_pending" })).toEqual({ event: true, comments: false });
  });

  it("flags the event when votes changed, including a changed vote with the same count", () => {
    expect(pollChanges(base, { ...base, responseCount: 3, latestResponseAt: "2026-09-25T10:01:00+08:00" }).event).toBe(true);
    expect(pollChanges(base, { ...base, latestResponseAt: "2026-09-25T10:01:00+08:00" }).event).toBe(true);
  });

  it("flags comments when a comment was added or deleted", () => {
    expect(pollChanges(base, { ...base, commentCount: 4, latestCommentAt: "2026-09-25T10:02:00+08:00" })).toEqual({ event: false, comments: true });
    // Deleting an older comment only changes the count.
    expect(pollChanges(base, { ...base, commentCount: 2 })).toEqual({ event: false, comments: true });
  });

  it("treats the first poll as a baseline, not a change", () => {
    expect(pollChanges(null, base)).toEqual({ event: false, comments: false });
  });
});
