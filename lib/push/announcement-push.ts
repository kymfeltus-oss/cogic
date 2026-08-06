import "server-only";

import { sendPushCampaign, type DeliveryCampaignResult } from "@/lib/push/deliver";
import { isWebPushConfigured } from "@/lib/push/vapid";

export async function sendAnnouncementPush(options: {
  announcementId: string;
  title: string;
  summary: string | null;
  body: string;
  priority: string;
  audience: string;
  createdBy: string;
}): Promise<DeliveryCampaignResult | null> {
  if (!isWebPushConfigured()) return null;

  const campaignKey = `announcement:${options.announcementId}`;
  const detail =
    options.summary?.trim() ||
    options.body.trim().slice(0, 120) ||
    "A new COGIC LIVE update is available.";

  return sendPushCampaign({
    campaignKey,
    kind: "announcement",
    announcementId: options.announcementId,
    audience: options.audience,
    priority: options.priority,
    createdBy: options.createdBy,
    payload: {
      title: "COGIC LIVE",
      body: `${options.title}\n\n${detail}\n\nTap to view update.`,
      url: "/updates",
      tag: campaignKey,
      kind: "announcement",
    },
  });
}
