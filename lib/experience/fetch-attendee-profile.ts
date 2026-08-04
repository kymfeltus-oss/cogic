import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";
import { parseNameFieldsFromMetadata } from "@/lib/experience/user-profile-display";
import {
  parseAvatarUrl,
  type AttendeeProfileRecord,
} from "@/lib/profile/attendee-profile";

export type AttendeeNameFields = {
  firstName: string;
  lastName: string;
};

/** Load synced profile fields from public.attendees for the signed-in user. */
export async function fetchAttendeeProfileRecord(
  userId: string,
): Promise<AttendeeProfileRecord | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("attendees")
    .select("first_name, last_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const { firstName, lastName } = parseNameFieldsFromMetadata({
    first_name: data.first_name,
    last_name: data.last_name,
  });
  const avatarUrl = parseAvatarUrl(data.avatar_url);

  if (!firstName && !lastName && !avatarUrl) {
    return null;
  }

  return { firstName, lastName, avatarUrl };
}

/** @deprecated Use fetchAttendeeProfileRecord instead. */
export async function fetchAttendeeNameFields(
  userId: string,
): Promise<AttendeeNameFields | null> {
  const record = await fetchAttendeeProfileRecord(userId);
  if (!record) return null;
  if (!record.firstName && !record.lastName) return null;
  return { firstName: record.firstName, lastName: record.lastName };
}
