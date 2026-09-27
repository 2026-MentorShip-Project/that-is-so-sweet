// Path-based routes, matching the backend's shareUrl (<frontend>/events/{id}):
//
//   <base>                     我揪的團 (or the login screen)
//   <base>events/new           create-event form
//   <base>events/{id}          event page
//   <base>events/{id}/edit     event page with the edit dialog open
//
// `tab` and the demo-only `hostToken` ride along in the query string. Old
// "#event={id}&tab=…&hostToken=…" links are still understood so previously
// shared links keep working.
//
// Paths need the host to serve index.html for every route (SPA fallback);
// Vite's dev server already does.

export type EventTab = "vote" | "heatmap";

export type AppRoute =
  | { name: "home" }
  | { name: "create" }
  | { name: "event"; eventId: string; edit: boolean; tab: EventTab | null; hostToken: string | null };

export type RouteTarget =
  | { name: "home" }
  | { name: "create" }
  | { name: "event"; eventId: string; edit?: boolean; tab?: EventTab | null; hostToken?: string | null };

function toTab(value: string | null): EventTab | null {
  return value === "vote" || value === "heatmap" ? value : null;
}

export function parseRoute(loc: { pathname: string; search: string; hash: string }, basePath: string): AppRoute {
  const legacy = new URLSearchParams(loc.hash.replace(/^#/, ""));
  const legacyEventId = legacy.get("event");
  if (legacyEventId) {
    return { name: "event", eventId: legacyEventId, edit: false, tab: toTab(legacy.get("tab")), hostToken: legacy.get("hostToken") };
  }

  const base = basePath.replace(/\/$/, "");
  const rest = (loc.pathname.startsWith(base) ? loc.pathname.slice(base.length) : loc.pathname).replace(/^\/|\/$/g, "");
  const segments = rest ? rest.split("/") : [];
  const query = new URLSearchParams(loc.search);

  if (segments.length === 0) return { name: "home" };
  if (segments[0] !== "events" || segments.length < 2) return { name: "home" };
  if (segments.length === 2 && segments[1] === "new") return { name: "create" };
  if (segments.length === 2 || (segments.length === 3 && segments[2] === "edit")) {
    return {
      name: "event",
      eventId: decodeURIComponent(segments[1]),
      edit: segments.length === 3,
      tab: toTab(query.get("tab")),
      hostToken: query.get("hostToken"),
    };
  }
  return { name: "home" };
}

export function buildUrl(route: RouteTarget, basePath: string): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  if (route.name === "home") return base;
  if (route.name === "create") return `${base}events/new`;

  const query = new URLSearchParams();
  if (route.tab) query.set("tab", route.tab);
  if (route.hostToken) query.set("hostToken", route.hostToken);
  const search = query.toString();
  return `${base}events/${encodeURIComponent(route.eventId)}${route.edit ? "/edit" : ""}${search ? `?${search}` : ""}`;
}
