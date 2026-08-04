import { redirect } from "next/navigation";
import { ATTENDEE_GATE_PATH } from "@/lib/auth/routing";

/** Legacy path — canonical login route is `/login`. */
export default function LegacyAttendeeGatePage() {
  redirect(ATTENDEE_GATE_PATH);
}
