import { redirect } from "next/navigation";
import { DEFAULT_ATTENDEE_NEXT } from "@/lib/auth/routing";

export const dynamic = "force-dynamic";

/** The welcome artwork is no longer shown at the root; enter the live app directly. */
export default function HomePage() {
  redirect(DEFAULT_ATTENDEE_NEXT);
}
