import { redirect } from "next/navigation";
import { DEFAULT_ATTENDEE_NEXT } from "@/lib/auth/routing";

/** Legacy path — attendee login is disabled. */
export default function LegacyCreateAccountPage() {
  redirect(DEFAULT_ATTENDEE_NEXT);
}
