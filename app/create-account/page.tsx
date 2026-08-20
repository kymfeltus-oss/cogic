import { redirect } from "next/navigation";
import { DEFAULT_ATTENDEE_NEXT } from "@/lib/auth/routing";

export const dynamic = "force-dynamic";

/** Attendee account creation is paused while public login is disabled. */
export default function CreateAccountPage() {
  redirect(DEFAULT_ATTENDEE_NEXT);
}
