import { redirect } from "next/navigation";
import { DEFAULT_ATTENDEE_NEXT } from "@/lib/auth/routing";

export const dynamic = "force-dynamic";

/** Attendee login is disabled — public entry continues to the dashboard. */
export default function LoginPage() {
  redirect(DEFAULT_ATTENDEE_NEXT);
}
