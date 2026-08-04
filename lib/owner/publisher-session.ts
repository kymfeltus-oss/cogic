import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerPublisherSession } from "@/lib/owner/contracts";
import {
  buildPublisherBrowserChannelName,
  buildPublisherChannelName,
} from "@/lib/owner/direct-camera-channels";
import { updateOwnerStreamState } from "@/lib/owner/load-owner-state";

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

export async function createOwnerPublisherSession(
  admin: SupabaseClient,
  updatedBy: string,
): Promise<{ session: OwnerPublisherSession | null; error: string | null }> {
  const sessionId = randomUUID();
  const channel = buildPublisherChannelName(sessionId);
  const browserChannel = buildPublisherBrowserChannelName(sessionId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { row, error } = await updateOwnerStreamState(admin, {
    publish_mode: "browser_camera",
    publish_status: "publishing",
    publish_error_message: null,
    publisher_session_id: sessionId,
    publisher_channel: channel,
    updated_by: updatedBy,
  });

  if (error || !row) {
    return { session: null, error: error ?? "Unable to create publisher session." };
  }

  return {
    session: { sessionId, channel, browserChannel, expiresAt },
    error: null,
  };
}

export async function clearOwnerPublisherSession(
  admin: SupabaseClient,
  updatedBy: string,
): Promise<{ error: string | null }> {
  const { error } = await updateOwnerStreamState(admin, {
    publisher_session_id: null,
    publisher_channel: null,
    publish_status: "offline",
    publish_mode: "none",
    updated_by: updatedBy,
  });

  return { error };
}
