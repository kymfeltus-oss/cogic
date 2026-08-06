import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { hydrateAuthMetadataFromAttendee } from "@/lib/auth/sync-attendee-profile";
import { fetchAttendeeProfileRecord } from "@/lib/experience/fetch-attendee-profile";
import { buildAttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import {
  normalizeProfileName,
  normalizeProfileTitle,
  persistAttendeeProfileUpdate,
} from "@/lib/profile/persist-attendee-profile";
import { isValidEmail } from "@/lib/auth/validation";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type ProfilePatchBody = {
  title?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

async function loadProfileSnapshot() {
  let user = await getUserFromSession();
  if (!user) {
    return null;
  }

  const attendeeRecord = await fetchAttendeeProfileRecord(user.id);
  user = await hydrateAuthMetadataFromAttendee(user);

  return buildAttendeeProfileSnapshot(user, attendeeRecord);
}

export async function GET() {
  const profile = await loadProfileSnapshot();

  if (!profile?.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = (await request.json()) as ProfilePatchBody;
    const firstName = normalizeProfileName(body.firstName ?? "");
    const lastName = normalizeProfileName(body.lastName ?? "");
    const title = normalizeProfileTitle(body.title ?? "");
    const email = body.email?.trim().toLowerCase() ?? "";

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First and last name are required." },
        { status: 400 },
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    await persistAttendeeProfileUpdate(user, { firstName, lastName, email, title });

    const admin = getSupabaseAdmin();
    const { data: refreshedUser, error: refreshError } = await admin.auth.admin.getUserById(
      user.id,
    );

    if (refreshError || !refreshedUser.user) {
      throw new Error(refreshError?.message ?? "Unable to reload profile.");
    }

    const attendeeRecord = await fetchAttendeeProfileRecord(user.id);
    const hydratedUser = await hydrateAuthMetadataFromAttendee(refreshedUser.user);
    const profile = buildAttendeeProfileSnapshot(hydratedUser, attendeeRecord);

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
