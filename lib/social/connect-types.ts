export const CONNECT_MAX_BODY_LENGTH = 200;
export const CONNECT_HISTORY_LIMIT = 100;
export const CONNECT_SLOW_MODE_SECONDS = 7;
export const CONNECT_MAX_MEDIA = 4;

export type ConnectMediaItem = {
  id?: string;
  mediaType: "image" | "video";
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  byteSize: number;
  sortOrder: number;
};

export type ConnectPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  likeCount: number;
  amenCount: number;
  mediaCount: number;
  isPinned: boolean;
  pinnedAt: string | null;
  createdAt: string;
  media: ConnectMediaItem[];
  viewerLiked: boolean;
  viewerAmened: boolean;
};

export type ConnectSession = {
  authenticated: boolean;
  userId: string | null;
  canSend: boolean;
  postingEnabled: boolean;
  mutedUntil: string | null;
  slowModeSeconds: number;
};

export type ConnectFeedPayload = {
  posts: ConnectPost[];
  pinned: ConnectPost | null;
  session: ConnectSession;
};

export type ConnectMediaInput = {
  type: "image" | "video";
  path: string;
  url: string;
  mimeType: string;
  size: number;
};
