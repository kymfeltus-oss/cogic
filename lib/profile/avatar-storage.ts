export const PROFILE_AVATAR_BUCKET = "profile-avatars";
export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedAvatarMimeType(mimeType: string): boolean {
  return ALLOWED_AVATAR_TYPES.has(mimeType);
}

export function avatarObjectPath(userId: string, mimeType: string): string {
  const extension =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${userId}/avatar.${extension}`;
}

export function publicAvatarUrl(baseUrl: string, path: string, cacheKey?: number): string {
  const url = `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/${PROFILE_AVATAR_BUCKET}/${path}`;
  return cacheKey ? `${url}?v=${cacheKey}` : url;
}
