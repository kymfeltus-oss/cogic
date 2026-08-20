import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";

export const TWO_NIGHT_PRODUCT_KEY = "TWO_NIGHT_EXPERIENCE_PASS_2026";

export type TravelRegistrationEligibility = {
  confirmed: boolean;
  officialHousingEligible: boolean;
  productKey: string | null;
  productName: string | null;
  maximumHousingNights: number | null;
  reason: string | null;
};

export async function resolveTravelRegistrationEligibility(
  userId: string | null | undefined,
): Promise<TravelRegistrationEligibility> {
  if (!userId) {
    return { confirmed:false, officialHousingEligible:false, productKey:null, productName:null, maximumHousingNights:null, reason:"Holy Convocation registration is required before accessing official convention housing." };
  }
  const db = getSupabaseAdmin();
  const { data: registration, error: registrationError } = await db
    .from("registrations")
    .select("registration_product_id,registration_products(product_key,name)")
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .eq("user_id", userId)
    .eq("is_primary_registrant", true)
    .eq("status", "confirmed")
    .order("created_at", { ascending:false })
    .limit(1)
    .maybeSingle();
  if (registrationError) throw registrationError;
  const product = Array.isArray(registration?.registration_products) ? registration.registration_products[0] : registration?.registration_products;
  const productKey = product?.product_key ?? null;
  if (!registration?.registration_product_id || !productKey) {
    return { confirmed:false, officialHousingEligible:false, productKey:null, productName:null, maximumHousingNights:null, reason:"Holy Convocation registration is required before accessing official convention housing." };
  }
  const { data: housingEntitlement, error: entitlementError } = await db
    .from("registration_product_entitlements")
    .select("entitlement_id,access_entitlements!inner(entitlement_type,active)")
    .eq("registration_product_id", registration.registration_product_id)
    .eq("active", true)
    .eq("access_entitlements.entitlement_type", "housing")
    .eq("access_entitlements.active", true)
    .limit(1)
    .maybeSingle();
  if (entitlementError) throw entitlementError;
  if (!housingEntitlement) {
    return { confirmed:true, officialHousingEligible:false, productKey, productName:product?.name ?? null, maximumHousingNights:null, reason:"Your confirmed registration does not include access to official convention housing." };
  }
  return {
    confirmed:true,
    officialHousingEligible:true,
    productKey,
    productName:product?.name ?? null,
    maximumHousingNights:productKey === TWO_NIGHT_PRODUCT_KEY ? 2 : null,
    reason:null,
  };
}

export function stayNightCount(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end-start)/86_400_000);
}

export function assertHotelStayEligible(
  eligibility: TravelRegistrationEligibility,
  checkIn: string,
  checkOut: string,
) {
  if (!eligibility.officialHousingEligible) throw new Error(eligibility.reason || "Official convention housing is unavailable.");
  const nights = stayNightCount(checkIn, checkOut);
  if (eligibility.maximumHousingNights != null && nights > eligibility.maximumHousingNights) {
    throw new Error("2-Night Experience Pass housing is limited to 2 nights.");
  }
}
