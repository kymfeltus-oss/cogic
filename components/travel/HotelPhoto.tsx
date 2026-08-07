import Image from "next/image";
import { Building2 } from "lucide-react";
import { resolveHotelImage } from "@/lib/travel/hotel-images";
import type { TravelHotel } from "@/lib/travel/types";

export default function HotelPhoto({
  hotel,
  className = "",
  sizes = "350px",
  priority = false,
}: {
  hotel: Pick<TravelHotel, "name" | "slug" | "image_url">;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const src = resolveHotelImage(hotel);
  if (!src) {
    return (
      <div className={`ct-hotel-placeholder ${className}`.trim()}>
        <Building2 />
        <span>Official hotel image coming soon</span>
      </div>
    );
  }
  return <Image src={src} fill sizes={sizes} alt={hotel.name} className={`object-cover ${className}`.trim()} priority={priority} />;
}
