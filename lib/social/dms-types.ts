export const DM_MAX_BODY_LENGTH = 200;
export const DM_MAX_MEDIA_URLS = 4;

export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  mediaUrls: string[];
  readAt: string | null;
  readStatus: "read" | "unread";
  createdAt: string;
};

export type DmConversationSummary = {
  peerUserId: string;
  lastMessageId: string;
  lastBody: string;
  lastCreatedAt: string;
  unreadCount: number;
};
