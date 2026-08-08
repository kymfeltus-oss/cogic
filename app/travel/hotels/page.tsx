import OfficialHotelsClient from "@/components/travel/OfficialHotelsClient";
import { TravelShell } from "@/components/travel/TravelShell";
import { publishedHotels } from "@/lib/travel/repository";

export const dynamic = "force-dynamic";

export default async function Page() {
  const hotels = await publishedHotels();

  return (
    <TravelShell back>
      <div className="ct-route-heading">
        <p className="ct-travel-eyebrow">LATEST COGIC HOUSING AVAILABILITY</p>
        <h1>Official COGIC Hotels</h1>
        <p>
          These are the remaining available hotels in the current official 118th Holy Convocation housing listing.
          Availability is manually published by COGIC and may change.
        </p>
      </div>

      <OfficialHotelsClient hotels={hotels} />

      <section className="ct-card ct-card--status ct-help-card">
        <h2>Need Housing Help?</h2>
        <p>
          Contact COGIC Housing at <a href="mailto:housing@cogic.org">housing@cogic.org</a> or{" "}
          <a href="tel:+17138242079">(713) 824-2079</a>.
        </p>
      </section>
    </TravelShell>
  );
}
