import { TravelShell } from "@/components/travel/TravelShell";
import { publishedHotels } from "@/lib/travel/repository";
import OfficialHotelsClient from "@/components/travel/OfficialHotelsClient";
import "../travel-home.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Official COGIC Hotels | COGIC Travel" };

export default async function Page() {
  const hotels = await publishedHotels();
  return (
    <TravelShell back>
      <p className="mt-8 font-bold tracking-[.2em] text-[#efbbff]">LATEST COGIC HOUSING AVAILABILITY</p>
      <h1 className="mt-3 text-5xl font-black">Official COGIC Hotels</h1>
      <p className="mt-4 max-w-3xl text-xl leading-8 text-white/70">
        These are the remaining available hotels in the current official 118th Holy Convocation housing listing.
        Availability is manually published by COGIC and may change.
      </p>
      <OfficialHotelsClient hotels={hotels} />
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
