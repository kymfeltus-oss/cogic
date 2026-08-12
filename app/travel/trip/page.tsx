import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TravelShell } from "@/components/travel/TravelShell";
import MyTripClient from "@/components/travel/MyTripClient";
import { getUserFromSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Trip | COGIC Travel",
  description:
    "Track marketplace checkout, supplier confirmations, and official housing interest (browse-and-request).",
};

export default async function TravelTripPage() {
  const user = await getUserFromSession();
  if (!user?.id) {
    redirect("/login?next=%2Ftravel%2Ftrip");
  }

  return (
    <TravelShell back>
      <h1 className="mt-8 text-4xl font-black sm:text-5xl">My Trip</h1>
      <p className="mt-3 max-w-3xl text-lg text-white/70 sm:text-xl">
        Confirmed stays are populated via marketplace checkouts and housing-completed registration stays
        only. Official COGIC hotel interest is browse-and-request — not confirmed in-app. Resume secure
        marketplace checkout from a pending attempt without relying on browser session storage.
      </p>
      <MyTripClient />
    </TravelShell>
  );
}
