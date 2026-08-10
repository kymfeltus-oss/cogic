import { redirect } from "next/navigation";
import { getUserFromSession } from "@/lib/auth/session";
import { markMarketplaceAttemptReturned } from "@/lib/travel/marketplace/booking";

export const dynamic = "force-dynamic";

export default async function MarketplaceReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const user = await getUserFromSession();
  const { attempt } = await searchParams;
  if (!user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/travel/marketplace/return?attempt=${attempt || ""}`)}`);
  }
  if (!attempt) {
    redirect("/travel/trip");
  }

  try {
    await markMarketplaceAttemptReturned(attempt, user.id);
  } catch {
    redirect("/travel/trip?marketplace=error");
  }

  // Redirect alone never confirms a reservation.
  redirect("/travel/trip?marketplace=pending");
}
