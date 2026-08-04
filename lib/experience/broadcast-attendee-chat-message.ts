import {
  ATTENDEE_CHAT_MESSAGE_EVENT,
  REALTIME_ATTENDEE_CHAT_CHANNEL,
  type AttendeeChatBroadcastPayload,
} from "@/lib/experience/attendee-chat-realtime";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/** Push a new chat row to all `realtime_attendee_chat` subscribers (countdown monitor, ops alerts). */
export async function broadcastAttendeeChatMessage(
  payload: AttendeeChatBroadcastPayload,
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const channel = supabaseAdmin.channel(REALTIME_ATTENDEE_CHAT_CHANNEL);

  try {
    const result = await channel.httpSend(
      ATTENDEE_CHAT_MESSAGE_EVENT,
      payload,
      { timeout: 5000 },
    );

    if (result.success === false) {
      throw new Error(`Attendee chat broadcast failed: ${result.error}`);
    }
  } finally {
    await supabaseAdmin.removeChannel(channel);
  }
}
