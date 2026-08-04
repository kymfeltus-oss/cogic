import {
  DEFAULT_COUNTDOWN_CONFIG,
  DEFAULT_EVENT_ID,
  mapCountdownConfigRow,
  type EventCountdownConfig,
} from "@/lib/live/countdown-config";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function loadActiveCountdownConfig(): Promise<EventCountdownConfig> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("event_countdown_config")
      .select("*")
      .eq("event_id", DEFAULT_EVENT_ID)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) return DEFAULT_COUNTDOWN_CONFIG;
    return mapCountdownConfigRow(data);
  } catch {
    return DEFAULT_COUNTDOWN_CONFIG;
  }
}

export async function loadAdminCountdownConfig(): Promise<EventCountdownConfig> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("event_countdown_config")
      .select("*")
      .eq("event_id", DEFAULT_EVENT_ID)
      .maybeSingle();

    if (error || !data) return DEFAULT_COUNTDOWN_CONFIG;
    return mapCountdownConfigRow(data);
  } catch {
    return DEFAULT_COUNTDOWN_CONFIG;
  }
}

export async function saveCountdownConfig(
  config: EventCountdownConfig,
): Promise<EventCountdownConfig> {
  const supabase = getSupabaseAdmin();
  const payload = {
    event_id: DEFAULT_EVENT_ID,
    headline: config.headline,
    eyebrow: config.eyebrow,
    subtitle: config.subtitle,
    start_time: config.start_time,
    end_time: config.end_time,
    schedule_timezone: config.schedule_timezone,
    status_label: config.status_label,
    cta_label_waiting: config.cta_label_waiting,
    cta_label_live: config.cta_label_live,
    helper_text: config.helper_text,
    outro_headline: config.outro_headline,
    outro_subtitle: config.outro_subtitle,
    outro_status_label: config.outro_status_label,
    hero_background_url: config.hero_background_url,
    countdown_frame_url: config.countdown_frame_url,
    waiting_pill_url: config.waiting_pill_url,
    button_frame_url: config.button_frame_url,
    is_active: config.is_active,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("event_countdown_config")
    .upsert(payload, { onConflict: "event_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to save countdown config.");
  }

  return mapCountdownConfigRow(data);
}
