import { redirect } from "next/navigation";
import TicketStoreClient from "@/components/tickets/TicketStoreClient";
import { isAttendeeAuthOpen } from "@/lib/auth/attendee-auth-open";
import { getUserFromSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getUserFromSession();
  if (!user && !isAttendeeAuthOpen()) {
    redirect("/login?next=%2Ftickets");
  }

  return <TicketStoreClient />;
}
