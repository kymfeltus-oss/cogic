import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TravelShell } from "@/components/travel/TravelShell";
import MyTripClient from "@/components/travel/MyTripClient";
import { getUserFromSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Trip | COGIC Travel",
  description: "Manage your official COGIC hotel reservation and trip details.",
};

export default async function TravelTripPage() {
  const user = await getUserFromSession();
  if (!user?.id) {
    redirect("/login?next=%2Ftravel%2Ftrip");
  }

  return (
    <TravelShell back>
      <h1 className="mt-8 text-5xl font-black">My Trip</h1>
      <p className="mt-3 max-w-3xl text-xl text-white/70">
        Add your real hotel confirmation after you book. Redirects never confirm a reservation.
      </p>
      <MyTripClient />
    </TravelShell>
  );
}
