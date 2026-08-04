import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { fetchAttendeeProfileRecord } from "@/lib/experience/fetch-attendee-profile";
import { buildAttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import {
  avatarObjectPath,
  isAllowedAvatarMimeType,
  PROFILE_AVATAR_BUCKET,
  PROFILE_AVATAR_MAX_BYTES,
  publicAvatarUrl,
} from "@/lib/profile/avatar-storage";
import {
  normalizeProfileName,
  persistAttendeeProfileUpdate,
} from "@/lib/profile/persist-attendee-profile";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Profile photo file is required." }, { status: 400 });
    }

    if (!isAllowedAvatarMimeType(file.type)) {
      return NextResponse.json(
        { error: "Use a JPG, PNG, or WebP image." },
        { status: 400 },
      );
    }

    if (file.size > PROFILE_AVATAR_MAX_BYTES) {
      return NextResponse.json({ error: "Profile photo must be 5 MB or smaller." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const objectPath = avatarObjectPath(user.id, file.type);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, fileBuffer, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
    }

    const avatarUrl = publicAvatarUrl(supabaseUrl, objectPath, Date.now());
    const attendeeRecord = await fetchAttendeeProfileRecord(user.id);
    const firstName =
      normalizeProfileName(
        (user.user_metadata?.first_name as string | undefined) ??
          attendeeRecord?.firstName ??
          "",
      ) || "Guest";
    const lastName =
      normalizeProfileName(
        (user.user_metadata?.last_name as string | undefined) ??
          attendeeRecord?.lastName ??
          "",
      ) || "User";

    await persistAttendeeProfileUpdate(user, {
      firstName,
      lastName,
      avatarUrl,
    });

    const profile = buildAttendeeProfileSnapshot(
      {
        ...user,
        user_metadata: {
          ...user.user_metadata,
          first_name: firstName,
          last_name: lastName,
          avatar_url: avatarUrl,
        },
      },
      { firstName, lastName, avatarUrl },
    );

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload profile photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();
    const prefix = `${user.id}/`;

    const { data: objects, error: listError } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .list(user.id);

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const paths = (objects ?? []).map((item) => `${prefix}${item.name}`);
    if (paths.length > 0) {
      await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove(paths);
    }

    const attendeeRecord = await fetchAttendeeProfileRecord(user.id);
    const firstName =
      normalizeProfileName(
        (user.user_metadata?.first_name as string | undefined) ??
          attendeeRecord?.firstName ??
          "",
      ) || "Guest";
    const lastName =
      normalizeProfileName(
        (user.user_metadata?.last_name as string | undefined) ??
          attendeeRecord?.lastName ??
          "",
      ) || "User";

    await persistAttendeeProfileUpdate(user, {
      firstName,
      lastName,
      avatarUrl: null,
    });

    const profile = buildAttendeeProfileSnapshot(
      {
        ...user,
        user_metadata: {
          ...user.user_metadata,
          first_name: firstName,
          last_name: lastName,
          avatar_url: null,
        },
      },
      { firstName, lastName, avatarUrl: null },
    );

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove profile photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
