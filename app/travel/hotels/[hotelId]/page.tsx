import { notFound } from "next/navigation";
import HotelAvailabilityClient from "@/components/travel/HotelAvailabilityClient";
import HotelPhoto from "@/components/travel/HotelPhoto";
import { TravelShell } from "@/components/travel/TravelShell";
import { getUserFromSession } from "@/lib/auth/session";
import { publishedHotel } from "@/lib/travel/repository";
import { userHotelState } from "@/lib/travel/reservations";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>;
}) {
  const [{ hotelId }, query] = await Promise.all([params, searchParams]);
  const hotel = await publishedHotel(hotelId);
  if (!hotel) notFound();

  const user = await getUserFromSession();
  const state = user?.id ? await userHotelState(user.id) : null;
  const staying = state?.reservations.find(
    (reservation) => reservation.hotel_id === hotel.id && reservation.reservation_status === "confirmed",
  );

  return (
    <TravelShell back>
      <p className="ct-travel-eyebrow">
        {hotel.cogic_designation === "BISHOPS" ? "BISHOPS HOTEL" : "OFFICIAL COGIC HOUSING"}
      </p>
      <h1 className="ct-travel-title">{hotel.name}</h1>

      <div className="ct-card ct-card--primary ct-hotel-detail-hero">
        <HotelPhoto hotel={hotel} sizes="(max-width: 768px) 100vw, 896px" priority />
      </div>

      {staying ? (
        <div className="ct-card ct-card--status ct-detail-status">
          <strong>✓ YOU&apos;RE STAYING HERE</strong>
          <p>Your reservation: {staying.check_in} – {staying.check_out}</p>
          <a href="/travel">View COGIC Travel</a>
          <p>Need another room? View availability below.</p>
        </div>
      ) : null}

      <div className="ct-detail-tags">
        {hotel.minimum_nights ? <span>{hotel.minimum_nights} NIGHT MINIMUM</span> : null}
        <span>Latest COGIC Housing Availability</span>
      </div>

      <p className="ct-travel-description">{hotel.description}</p>

      {hotel.amenities.length ? (
        <ul className="ct-card ct-card--status ct-detail-amenities">
          {hotel.amenities.map((amenity) => (
            <li key={amenity}>{amenity}</li>
          ))}
        </ul>
      ) : null}

      <HotelAvailabilityClient
        hotel={hotel}
        initialCheckIn={query.checkIn || "2026-11-03"}
        initialCheckOut={query.checkOut || "2026-11-09"}
      />

      <section className="ct-card ct-card--status ct-help-card">
        <h2>Need Housing Help?</h2>
        <p>
          <a href="mailto:housing@cogic.org">housing@cogic.org</a> · <a href="tel:+17138242079">(713) 824-2079</a>
        </p>
      </section>
    </TravelShell>
  );
}
