import type { User } from "@supabase/supabase-js";
import { isValidEmail } from "@/lib/auth/validation";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type AttendeeProfileUpdate = {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  email?: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
};

export function normalizeProfileName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function persistAttendeeProfileUpdate(
  user: User,
  input: AttendeeProfileUpdate,
): Promise<void> {
  const firstName = normalizeProfileName(input.firstName);
  const lastName = normalizeProfileName(input.lastName);
  const isGuest = user.user_metadata?.is_guest === true;

  const userMetadata: Record<string, unknown> = {
    ...user.user_metadata,
    first_name: firstName,
    last_name: lastName,
  };

  if (input.avatarUrl !== undefined) {
    userMetadata.avatar_url = input.avatarUrl;
  }

  if (input.phone !== undefined) {
    userMetadata.phone = input.phone;
  }

  if (input.city !== undefined) {
    userMetadata.city = input.city;
  }

  if (input.state !== undefined) {
    userMetadata.state = input.state;
  }

  let nextAuthEmail: string | undefined;

  if (input.email !== undefined) {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      throw new Error("Valid email is required.");
    }

    if (isGuest) {
      userMetadata.contact_email = normalizedEmail;
    } else {
      nextAuthEmail = normalizedEmail;
    }
  }

  const admin = getSupabaseAdmin();

  const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
    ...(nextAuthEmail
      ? {
          email: nextAuthEmail,
          email_confirm: true,
        }
      : {}),
    user_metadata: userMetadata,
  });

  if (authError) {
    throw new Error(authError.message);
  }

  if (nextAuthEmail) {
    const { error: attendeeEmailError } = await admin
      .from("attendees")
      .update({ email: nextAuthEmail })
      .eq("id", user.id);

    if (attendeeEmailError) {
      throw new Error(attendeeEmailError.message);
    }
  }

  const attendeeUpdate: Record<string, string | null> = {
    first_name: firstName,
    last_name: lastName,
  };

  if (input.avatarUrl !== undefined) {
    attendeeUpdate.avatar_url = input.avatarUrl;
  }

  if (input.phone !== undefined) {
    attendeeUpdate.phone = input.phone;
  }

  if (input.city !== undefined) {
    attendeeUpdate.city = input.city;
  }

  if (input.state !== undefined) {
    attendeeUpdate.state = input.state;
  }

  const { error: attendeeError } = await admin
    .from("attendees")
    .update(attendeeUpdate)
    .eq("id", user.id);

  if (attendeeError) {
    throw new Error(attendeeError.message);
  }
}
