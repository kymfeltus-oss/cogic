import { TravelShell } from "@/components/travel/TravelShell";
import { publishedHotels } from "@/lib/travel/repository";
import HotelSearchClient from "@/components/travel/HotelSearchClient";
import Link from "next/link";
import { getUserFromSession } from "@/lib/auth/session";
import { resolveTravelRegistrationEligibility } from "@/lib/travel/registration-eligibility";
import "../travel-home.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Official COGIC Hotels | COGIC Travel" };

export default async function Page() {
  const user = await getUserFromSession();
  const eligibility = await resolveTravelRegistrationEligibility(user?.id);
  if (!eligibility.officialHousingEligible) {
    return (
      <TravelShell back>
        <h1 className="mt-10 text-4xl font-black">Official convention housing requires registration</h1>
        <p className="mt-4 max-w-2xl text-xl text-white/75">{eligibility.reason}</p>
        <Link className="mt-6 inline-flex rounded-full bg-[#e4b938] px-6 py-3 font-black text-black" href="/register">
          Register Now
        </Link>
      </TravelShell>
    );
  }
  const hotels = await publishedHotels();
  return (
    <TravelShell back>
      <p className="mt-8 font-bold tracking-[.2em] text-[#efbbff]">LATEST COGIC HOUSING AVAILABILITY</p>
      <h1 className="mt-3 text-5xl font-black">Official COGIC Hotels</h1>
      <p className="mt-4 max-w-3xl text-xl leading-8 text-white/70">
        Expedia-style split view: scroll hotel cards on the left while the live Leaflet map on the right stays
        sticky. Pins use real <code>latitude</code>/<code>longitude</code> from official inventory and marketplace
        search. Pan or zoom to pass <code>northEast</code>/<code>southWest</code> bounds into search and re-rank
        the sidebar instantly.
      </p>
      <HotelSearchClient hotels={hotels} />
      <section className="mt-12 rounded-3xl border border-[#e4b938]/30 bg-[#e4b938]/10 p-6">
        <h2 className="text-2xl font-bold">Need Housing Help?</h2>
        <p className="mt-2 text-lg">
          Contact COGIC Housing at{" "}
          <a className="underline" href="mailto:housing@cogic.org">
            housing@cogic.org
          </a>{" "}
          or{" "}
          <a className="underline" href="tel:+17138242079">
            (713) 824-2079
          </a>
          .
        </p>
      </section>
    </TravelShell>
  );
}
