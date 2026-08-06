export const MEDIA_UPLOAD_BUCKET = "media-uploads";
export const MEDIA_UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export function isAllowedVideoMimeType(mimeType: string): boolean {
  return ALLOWED_VIDEO_TYPES.has(mimeType);
}

export function mediaObjectPath(ownerUserId: string, recordingId: string, mimeType: string): string {
  const extension =
    mimeType === "video/webm" ? "webm" : mimeType === "video/quicktime" ? "mov" : "mp4";
  return `manual/${ownerUserId}/${recordingId}.${extension}`;
}

export function publicMediaUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_UPLOAD_BUCKET}/${path}`;
}
