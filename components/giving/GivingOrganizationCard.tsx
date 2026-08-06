import { Church, MapPin } from "lucide-react";
import { COGIC_GIVING_ORG } from "@/lib/giving/brand";

export default function GivingOrganizationCard() {
  return (
    <div className="cogic-giving-org" aria-label="Giving organization">
      <Church className="cogic-giving-org__icon size-6" aria-hidden="true" />
      <div>
        <p className="cogic-giving-org__name">{COGIC_GIVING_ORG.name}</p>
        <p className="cogic-giving-org__loc">
          <MapPin className="size-3.5 text-[var(--cg-gold)]" aria-hidden="true" />
          {COGIC_GIVING_ORG.location}
        </p>
      </div>
    </div>
  );
}
