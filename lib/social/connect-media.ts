export const CONNECT_MEDIA_BUCKET = "connect-media";
export const CONNECT_MEDIA_MAX_BYTES = 52_428_800;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export function isAllowedConnectMediaMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.trim().toLowerCase());
}

export function connectMediaTypeFromMime(mime: string): "image" | "video" | null {
  const normalized = mime.trim().toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  return null;
}

export function connectMediaObjectPath(userId: string, mimeType: string): string {
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : mimeType === "video/mp4"
            ? "mp4"
            : mimeType === "video/webm"
              ? "webm"
              : mimeType === "video/quicktime"
                ? "mov"
                : "jpg";
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}/${Date.now()}-${unique}.${ext}`;
}

export function publicConnectMediaUrl(supabaseUrl: string, objectPath: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${CONNECT_MEDIA_BUCKET}/${objectPath}`;
}
