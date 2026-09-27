import { EventComment } from "../../types";

export interface LoadedComments {
  comments: EventComment[]; // oldest first
  nextCursor: string | null; // cursor for the next older page; null = nothing older
}

const olderThan = (a: EventComment, b: EventComment) => {
  const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return diff < 0 || (diff === 0 && a.id < b.id);
};

// Folds a freshly fetched latest page (after polling saw comments change)
// into what's on screen. The latest page is authoritative for its own time
// range, so new comments appear and deleted ones disappear. Comments older
// than that range (loaded via 載入較早的留言, or pushed out of the page by
// new ones) are kept along with the existing cursor, so loading older
// comments later continues where it left off instead of repeating them.
// A deletion among those older comments only shows after a reload.
export function mergeLatestComments(current: LoadedComments, latest: LoadedComments): LoadedComments {
  const oldestInLatest = latest.comments[0];
  if (!oldestInLatest) return latest;
  const olderKept = current.comments.filter((c) => olderThan(c, oldestInLatest));
  if (olderKept.length === 0) return latest;
  return { comments: [...olderKept, ...latest.comments], nextCursor: current.nextCursor };
}
