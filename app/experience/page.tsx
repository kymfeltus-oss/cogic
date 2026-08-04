import { redirect } from "next/navigation";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

/** Legacy home path — canonical attendee hub is `/attendee-dashboard`. */
export default function LegacyExperienceHomePage() {
  redirect(ATTENDEE_DASHBOARD_PATH);
}
