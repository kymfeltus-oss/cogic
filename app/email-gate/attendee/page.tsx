import { redirect } from "next/navigation";
import { DEFAULT_ATTENDEE_NEXT } from "@/lib/auth/routing";

/** Legacy attendee gate — login is disabled. */
export default function LegacyAttendeeGatePage() {
  redirect(DEFAULT_ATTENDEE_NEXT);
}
