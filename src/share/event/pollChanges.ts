import { EventPollStatus } from "../../types";

// Which full resources to refetch after a poll. `event` covers the event
// itself and its votes (both come back from GET /api/events/{id}/);
// `comments` covers GET /api/events/{id}/comments/. The first poll (no
// previous snapshot) is only a baseline.
export function pollChanges(prev: EventPollStatus | null, next: EventPollStatus): { event: boolean; comments: boolean } {
  if (!prev) return { event: false, comments: false };
  return {
    event:
      prev.status !== next.status ||
      prev.displayStatus !== next.displayStatus ||
      prev.eventUpdatedAt !== next.eventUpdatedAt ||
      prev.responseCount !== next.responseCount ||
      prev.latestResponseAt !== next.latestResponseAt,
    comments: prev.commentCount !== next.commentCount || prev.latestCommentAt !== next.latestCommentAt,
  };
}
