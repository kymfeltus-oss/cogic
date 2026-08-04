import {
  LIVE_ROOM_PLATFORM_CHANNEL,
  LIVE_STREAM_STATE_BROADCAST_EVENT,
} from "@/lib/live/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SYNC_TIMEOUT_MS = 5_000;

/** Notify attendee clients to re-sync /api/access/live after owner mutations. */
export async function emitStreamStateSync(): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const channel = supabase.channel(LIVE_ROOM_PLATFORM_CHANNEL);

    await new Promise<void>((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        void supabase.removeChannel(channel);
        resolve();
      };

      const timeoutId = setTimeout(finish, SYNC_TIMEOUT_MS);

      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        try {
          await channel.send({
            type: "broadcast",
            event: LIVE_STREAM_STATE_BROADCAST_EVENT,
            payload: { at: new Date().toISOString() },
          });
        } catch (error) {
          console.error("[owner] stream-state-sync broadcast failed:", error);
        } finally {
          clearTimeout(timeoutId);
          finish();
        }
      });
    });
  } catch (error) {
    console.error("[owner] emitStreamStateSync failed:", error);
  }
}
