import { NextResponse } from "next/server";
import {
  ALTERNATE_ATTENDEE_EXPERIENCE_KEYS,
  buildAttendeeFeedOption,
  DEFAULT_ATTENDEE_EXPERIENCE,
  isAttendeeExperienceKey,
  type AttendeeStreamFeedOption,
} from "@/lib/experience/stream-experiences";
import { isValidHlsUrl } from "@/lib/live/hls";
import { LIVE_STREAM_STATE_ID } from "@/lib/live/types";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type StreamFeedRow = {
  feed_key: string;
  playback_url: string | null;
  is_active: boolean;
};

/**
 * Read-only attendee feed registry — published stream experiences only.
 * Does not expose operator or hardware controls.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email?.trim()) {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data: streamState, error: streamError } = await admin
      .from("live_stream_state")
      .select("is_live, active_source, playback_url, primary_playback_url, backup_playback_url")
      .eq("id", LIVE_STREAM_STATE_ID)
      .maybeSingle();

    if (streamError) {
      console.error("Stream feed registry load failed:", streamError.message);
      return NextResponse.json(
        { error: "Unable to load stream experiences." },
        { status: 500 },
      );
    }

    const isLive =
      streamState?.is_live === true && streamState.active_source !== "offline";

    if (!isLive) {
      return NextResponse.json({ feeds: [] as AttendeeStreamFeedOption[] });
    }

    const feeds: AttendeeStreamFeedOption[] = [buildAttendeeFeedOption(DEFAULT_ATTENDEE_EXPERIENCE)];

    const { data: feedRows, error: feedsError } = await admin
      .from("stream_feeds")
      .select("feed_key, playback_url, is_active")
      .eq("event_id", LIVE_STREAM_STATE_ID)
      .eq("is_active", true);

    if (feedsError) {
      console.error("Alternate stream feed lookup failed:", feedsError.message);
      return NextResponse.json({ feeds });
    }

    const activeKeys = new Set<string>();

    for (const row of (feedRows ?? []) as StreamFeedRow[]) {
      if (!row.is_active || !isValidHlsUrl(row.playback_url)) continue;
      if (!isAttendeeExperienceKey(row.feed_key)) continue;
      if (row.feed_key === DEFAULT_ATTENDEE_EXPERIENCE) continue;
      if (!ALTERNATE_ATTENDEE_EXPERIENCE_KEYS.includes(row.feed_key)) continue;
      if (activeKeys.has(row.feed_key)) continue;
      activeKeys.add(row.feed_key);
      feeds.push(buildAttendeeFeedOption(row.feed_key));
    }

    return NextResponse.json(
      { feeds },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  } catch (error) {
    console.error("Attendee stream feeds route error:", error);
    return NextResponse.json(
      { error: "Unable to load stream experiences." },
      { status: 500 },
    );
  }
}
