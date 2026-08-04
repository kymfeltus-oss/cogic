/** Canonical attendee live experience — Viewer POV Go Live at /live. */
export const EXPERIENCE_LIVE_PATH = "/live";

/** Public shareable countdown — rings + event date (pre-show announcement surface). */
export const PUBLIC_COUNTDOWN_PATH = "/countdown";

/** True when pathname is an attendee live or countdown destination. */
export function isAttendeeLiveSurfacePath(pathname: string): boolean {
  return (
    pathname === EXPERIENCE_LIVE_PATH ||
    pathname.startsWith(`${EXPERIENCE_LIVE_PATH}/`) ||
    pathname === PUBLIC_COUNTDOWN_PATH ||
    pathname.startsWith(`${PUBLIC_COUNTDOWN_PATH}/`)
  );
}

/** Legacy `/experience/live` and aliases forward here. */
export function experienceLivePathWithQuery(searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${EXPERIENCE_LIVE_PATH}?${query}` : EXPERIENCE_LIVE_PATH;
}

export function experienceLivePathFromRecord(
  params: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
      continue;
    }
    query.set(key, value);
  }

  return experienceLivePathWithQuery(query);
}
