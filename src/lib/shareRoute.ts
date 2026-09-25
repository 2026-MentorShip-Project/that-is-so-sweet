// The backend's shareUrl is "<frontend>/events/{id}", while the app itself
// routes by hash (#event={id}). App normalizes the former into the latter on
// load. Matched at the end of the path so it works under a deploy base path.
export function eventIdFromSharePath(pathname: string): string | null {
  const match = pathname.match(/\/events\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}
