import type { User } from "@supabase/supabase-js";
import {
  resolveUserProfileDisplay,
  type UserProfileDisplay,
} from "@/lib/experience/user-profile-display";

export type AttendeeProfileRecord = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type AttendeeProfileSnapshot = UserProfileDisplay & {
  avatarUrl: string | null;
  email: string | null;
  isGuest: boolean;
  userId: string | null;
};

export function parseAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseContactEmail(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const raw = metadata?.contact_email ?? metadata?.contactEmail;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

export function resolveAvatarUrl(
  metadata: Record<string, unknown> | null | undefined,
  attendeeRecord?: Pick<AttendeeProfileRecord, "avatarUrl"> | null,
): string | null {
  return (
    parseAvatarUrl(metadata?.avatar_url ?? metadata?.avatarUrl) ??
    attendeeRecord?.avatarUrl ??
    null
  );
}

export function buildAttendeeProfileSnapshot(
  user: User | null,
  attendeeRecord?: AttendeeProfileRecord | null,
): AttendeeProfileSnapshot {
  const attendeeNames = attendeeRecord
    ? { firstName: attendeeRecord.firstName, lastName: attendeeRecord.lastName }
    : null;
  const display = resolveUserProfileDisplay(user, attendeeNames);
  const authEmail = user?.email?.trim().toLowerCase() ?? null;
  const isGuest = user?.user_metadata?.is_guest === true;
  const contactEmail = parseContactEmail(user?.user_metadata);
  const guestSessionEmail =
    authEmail?.endsWith("@awakening.local") === true ? authEmail : null;

  return {
    ...display,
    avatarUrl: resolveAvatarUrl(user?.user_metadata, attendeeRecord),
    email: isGuest ? (contactEmail ?? (guestSessionEmail ? "" : authEmail)) : authEmail,
    isGuest,
    userId: user?.id ?? null,
  };
}

export function snapshotFromProfileFields(input: {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string | null;
  isGuest: boolean;
  userId: string | null;
}): AttendeeProfileSnapshot {
  const display = resolveUserProfileDisplay(
    input.userId
      ? ({
          id: input.userId,
          email: input.email,
          user_metadata: {
            is_guest: input.isGuest,
            first_name: input.firstName,
            last_name: input.lastName,
            avatar_url: input.avatarUrl,
          },
        } as unknown as User)
      : null,
    { firstName: input.firstName, lastName: input.lastName },
  );

  return {
    ...display,
    avatarUrl: input.avatarUrl,
    email: input.email,
    isGuest: input.isGuest,
    userId: input.userId,
  };
}
