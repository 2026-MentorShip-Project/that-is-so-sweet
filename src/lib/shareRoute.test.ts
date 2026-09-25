import { describe, expect, it } from "vitest";
import { eventIdFromSharePath } from "./shareRoute";

describe("eventIdFromSharePath", () => {
  it("reads the event id from the backend share link path", () => {
    expect(eventIdFromSharePath("/events/ayQNb8TK")).toBe("ayQNb8TK");
  });

  it("works under a deploy base path and with a trailing slash", () => {
    expect(eventIdFromSharePath("/That-is-so-sweet/events/ayQNb8TK/")).toBe("ayQNb8TK");
  });

  it("ignores paths that are not an event share link", () => {
    expect(eventIdFromSharePath("/")).toBeNull();
    expect(eventIdFromSharePath("/That-is-so-sweet/")).toBeNull();
    expect(eventIdFromSharePath("/events/")).toBeNull();
    expect(eventIdFromSharePath("/events/ayQNb8TK/comments")).toBeNull();
  });

  it("decodes an encoded id", () => {
    expect(eventIdFromSharePath("/events/a%20b")).toBe("a b");
  });
});
