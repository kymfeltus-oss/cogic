import { redirect } from "next/navigation";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

/** Legacy attendee home — forwards to the attendee dashboard hub. */
export default function DashboardPage() {
  redirect(ATTENDEE_DASHBOARD_PATH);
}
