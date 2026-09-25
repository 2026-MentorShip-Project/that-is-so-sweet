import { describe, expect, it } from "vitest";
import { buildUrl, parseRoute } from "./router";

const BASE = "/That-is-so-sweet/";
const at = (pathname: string, search = "", hash = "") => parseRoute({ pathname, search, hash }, BASE);

describe("parseRoute", () => {
  it("maps the base path to 我揪的團", () => {
    expect(at("/That-is-so-sweet/")).toEqual({ name: "home" });
    expect(at("/That-is-so-sweet")).toEqual({ name: "home" });
  });

  it("maps /events/new to the create form", () => {
    expect(at("/That-is-so-sweet/events/new")).toEqual({ name: "create" });
  });

  it("maps /events/{id} to the event page", () => {
    expect(at("/That-is-so-sweet/events/ayQNb8TK")).toEqual({ name: "event", eventId: "ayQNb8TK", edit: false, tab: null, hostToken: null });
    expect(at("/That-is-so-sweet/events/ayQNb8TK/")).toMatchObject({ name: "event", eventId: "ayQNb8TK", edit: false });
  });

  it("maps /events/{id}/edit to the event page with the edit dialog open", () => {
    expect(at("/That-is-so-sweet/events/ayQNb8TK/edit")).toMatchObject({ name: "event", eventId: "ayQNb8TK", edit: true });
  });

  it("reads the tab and demo host token from the query string", () => {
    expect(at("/That-is-so-sweet/events/demo-gathering", "?tab=heatmap&hostToken=demo-host-token-123")).toEqual({
      name: "event",
      eventId: "demo-gathering",
      edit: false,
      tab: "heatmap",
      hostToken: "demo-host-token-123",
    });
    expect(at("/That-is-so-sweet/events/x", "?tab=bogus")).toMatchObject({ tab: null });
  });

  it("still understands old #event= links", () => {
    expect(at("/That-is-so-sweet/", "", "#event=ayQNb8TK&tab=vote")).toEqual({ name: "event", eventId: "ayQNb8TK", edit: false, tab: "vote", hostToken: null });
  });

  it("works when the app is served from /", () => {
    expect(parseRoute({ pathname: "/events/ayQNb8TK", search: "", hash: "" }, "/")).toMatchObject({ name: "event", eventId: "ayQNb8TK" });
    expect(parseRoute({ pathname: "/", search: "", hash: "" }, "/")).toEqual({ name: "home" });
  });

  it("falls back to 我揪的團 for unknown paths", () => {
    expect(at("/That-is-so-sweet/nope")).toEqual({ name: "home" });
    expect(at("/That-is-so-sweet/events/ayQNb8TK/comments")).toEqual({ name: "home" });
  });
});

describe("buildUrl", () => {
  it("builds each route under the base path", () => {
    expect(buildUrl({ name: "home" }, BASE)).toBe("/That-is-so-sweet/");
    expect(buildUrl({ name: "create" }, BASE)).toBe("/That-is-so-sweet/events/new");
    expect(buildUrl({ name: "event", eventId: "ayQNb8TK" }, BASE)).toBe("/That-is-so-sweet/events/ayQNb8TK");
    expect(buildUrl({ name: "event", eventId: "ayQNb8TK", edit: true }, BASE)).toBe("/That-is-so-sweet/events/ayQNb8TK/edit");
  });

  it("keeps the tab and demo host token in the query string", () => {
    expect(buildUrl({ name: "event", eventId: "demo-gathering", tab: "vote", hostToken: "t1" }, BASE)).toBe(
      "/That-is-so-sweet/events/demo-gathering?tab=vote&hostToken=t1"
    );
  });

  it("round-trips through parseRoute", () => {
    const url = new URL(buildUrl({ name: "event", eventId: "a b", edit: true, tab: "heatmap" }, BASE), "http://x");
    expect(parseRoute({ pathname: url.pathname, search: url.search, hash: "" }, BASE)).toEqual({
      name: "event",
      eventId: "a b",
      edit: true,
      tab: "heatmap",
      hostToken: null,
    });
  });
});
