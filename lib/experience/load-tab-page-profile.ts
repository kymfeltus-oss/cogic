import { hydrateAuthMetadataFromAttendee } from "@/lib/auth/sync-attendee-profile";
import { getUserFromSession } from "@/lib/auth/session";
import { fetchAttendeeProfileRecord } from "@/lib/experience/fetch-attendee-profile";
import { buildAttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

/** Shared profile snapshot for bottom-nav artboard tab pages. */
export async function loadTabPageProfile() {
  try {
    let user = await getUserFromSession();
    let attendeeRecord = user ? await fetchAttendeeProfileRecord(user.id) : null;

    if (user) {
      user = await hydrateAuthMetadataFromAttendee(user);
      if (!attendeeRecord) {
        attendeeRecord = await fetchAttendeeProfileRecord(user.id);
      }
    }

    return buildAttendeeProfileSnapshot(user, attendeeRecord);
  } catch (error) {
    console.error("[loadTabPageProfile] Error loading tab page profile:", error);
    return buildAttendeeProfileSnapshot(null, null);
  }
}
