import type { User } from "@supabase/supabase-js";
import { parseNameFieldsFromMetadata } from "@/lib/experience/user-profile-display";
import { parseAvatarUrl } from "@/lib/profile/attendee-profile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function parseOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function hasCompleteName(firstName: string, lastName: string): boolean {
  return Boolean(firstName && lastName);
}

/** Keep public.attendees name columns aligned with auth user_metadata after signup/login. */
export async function syncAttendeeProfileFromAuthUser(user: User): Promise<void> {
  const { firstName, lastName } = parseNameFieldsFromMetadata(user.user_metadata);
  const avatarUrl = parseAvatarUrl(user.user_metadata);
  const phone = parseOptionalText(user.user_metadata?.phone);
  const city = parseOptionalText(user.user_metadata?.city);
  const state = parseOptionalText(user.user_metadata?.state);

  if (!firstName && !lastName && !avatarUrl && !phone && !city && !state) {
    return;
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("attendees")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      avatar_url: avatarUrl,
      phone,
      city,
      state,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[SYNC_ATTENDEE_PROFILE_ERR]:", error.message);
  }
}

/**
 * Backfill auth user_metadata from attendees when JWT is missing names
 * (legacy accounts or sessions created before signup collected names).
 */
export async function hydrateAuthMetadataFromAttendee(user: User): Promise<User> {
  const metadataNames = parseNameFieldsFromMetadata(user.user_metadata);
  const metadataAvatar = parseAvatarUrl(user.user_metadata);
  const needsNameHydration = !hasCompleteName(
    metadataNames.firstName,
    metadataNames.lastName,
  );
  const needsAvatarHydration = !metadataAvatar;

  if (!needsNameHydration && !needsAvatarHydration) {
    return user;
  }

  const admin = getSupabaseAdmin();
  const { data: attendee, error: attendeeError } = await admin
    .from("attendees")
    .select("first_name, last_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (attendeeError || !attendee) {
    return user;
  }

  const attendeeNames = parseNameFieldsFromMetadata({
    first_name: attendee.first_name,
    last_name: attendee.last_name,
  });
  const attendeeAvatar = parseAvatarUrl(attendee.avatar_url);

  const nextFirstName = needsNameHydration ? attendeeNames.firstName : metadataNames.firstName;
  const nextLastName = needsNameHydration ? attendeeNames.lastName : metadataNames.lastName;
  const nextAvatar = needsAvatarHydration ? attendeeAvatar : metadataAvatar;

  if (
    !hasCompleteName(nextFirstName, nextLastName) &&
    !nextAvatar
  ) {
    return user;
  }

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...user.user_metadata,
        ...(nextFirstName ? { first_name: nextFirstName } : {}),
        ...(nextLastName ? { last_name: nextLastName } : {}),
        ...(nextAvatar ? { avatar_url: nextAvatar } : {}),
      },
    },
  );

  if (updateError || !updated.user) {
    console.error("[HYDRATE_AUTH_METADATA_ERR]:", updateError?.message);
    return user;
  }

  return updated.user;
}

/** Bidirectional profile sync — metadata → attendees, then attendees → metadata if needed. */
export async function syncUserProfileIdentity(user: User): Promise<User> {
  await syncAttendeeProfileFromAuthUser(user);
  return hydrateAuthMetadataFromAttendee(user);
}
