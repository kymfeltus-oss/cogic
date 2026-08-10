#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const programKey = "cogic-stream-2026";
const registrationOnly = process.argv.includes("--registration-only");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const requireOk = (label, error) => { if (error) throw new Error(`${label}: ${error.message}`); };

const entitlements = [
  { entitlement_key: "CONVOCATION_SERVICE_ACCESS_2026", name: "Convocation Service Access", description: "Requires occurrence-specific owner access mapping before activation.", entitlement_type: "event_access", access_zone: "GENERAL_ENTRY", active: false },
  { entitlement_key: "GENERAL_SEATING_2026", name: "General Seating", description: "Requires occurrence-specific owner access mapping before activation.", entitlement_type: "seating", access_zone: "GENERAL_ENTRY", active: false },
  { entitlement_key: "PREFERRED_SEATING_2026", name: "Preferred / Reserved Seating", description: "Held until 15 minutes after each configured applicable service begins.", entitlement_type: "seating", access_zone: "PREFERRED_SEATING", preferred_hold_minutes: 15, active: false },
  { entitlement_key: "JUNIOR_GUARDIAN_SERVICE_ACCESS_2026", name: "Junior Guardian-Dependent Service Access", description: "Individual Junior credential; requires a verified guardian and occurrence-specific mapping.", entitlement_type: "event_access", access_zone: "GENERAL_ENTRY", guardian_required: true, active: false },
  { entitlement_key: "JUNIOR_GUARDIAN_SEATING_2026", name: "Junior Guardian-Eligible Seating", description: "Same eligible seating section as verified parent or guardian where configured.", entitlement_type: "seating", guardian_required: true, active: false },
  { entitlement_key: "HOUSING_GENERAL_2026", name: "Convention Housing Portal - General Blocks", entitlement_type: "housing", active: true },
  { entitlement_key: "HOUSING_TWO_NIGHT_2026", name: "Convention Housing Portal - 2-Night Limit", entitlement_type: "housing", active: true },
  { entitlement_key: "SPECIAL_GIFT_2026", name: "Special Gift", entitlement_type: "item", active: true },
  { entitlement_key: "CONVENTION_BADGE_2026", name: "Convention Badge", entitlement_type: "badge", active: true },
  { entitlement_key: "CHILD_IDENTIFYING_BADGE_2026", name: "Child-Identifying Registration Badge", entitlement_type: "badge", active: true },
  { entitlement_key: "PRINTED_PROGRAM_INCLUDED_2026", name: "Included Hard-Copy Holy Convocation Program", entitlement_type: "item", active: true },
  { entitlement_key: "DIGITAL_PROGRAM_2026", name: "Digital Holy Convocation Program", entitlement_type: "content", active: true },
  { entitlement_key: "COMMUNITY_DISCOUNTS_2026", name: "Community Discounts", entitlement_type: "discount", active: true },
];

const products = [
  { product_key: "DIAMOND_REGISTRATION_2026", name: "Diamond Registration", description: "Convocation registration with preferred seating benefits, registration materials, and housing portal access.", eligibility_description: "Required for Bishops, Supervisors, Elected Officials, and Appointed Officials. Eligibility is not inferred from salutation.", price_cents: 15000, badge_type: "Convention Badge", active: true, public: false, sort_order: 10 },
  { product_key: "GENERAL_REGISTRATION_2026", name: "General Registration", description: "Convocation registration with general seating, registration materials, community discounts, and housing portal access.", eligibility_description: null, price_cents: 12500, badge_type: "Convention Badge", active: true, public: true, sort_order: 20 },
  { product_key: "JUNIOR_REGISTRATION_GUEST_2026", name: "Junior Registration Guest", description: "For ages 5-17. Each Junior receives an individual credential and must be accompanied by a parent or guardian.", eligibility_description: "Ages 5-17; verified parent or guardian relationship required.", price_cents: 3500, badge_type: "Child-Identifying Registration Badge", active: true, public: true, sort_order: 30 },
  { product_key: "TWO_NIGHT_EXPERIENCE_PASS_2026", name: "2-Night Experience Pass", description: "Includes 2-night-limited housing portal access and the Digital Holy Convocation Program. No other registration materials are included. Service access remains unresolved.", eligibility_description: "Service-entry entitlement is not assigned until approved.", price_cents: 2500, badge_type: null, active: true, public: true, sort_order: 40 },
];

const assignmentKeys = {
  DIAMOND_REGISTRATION_2026: ["CONVOCATION_SERVICE_ACCESS_2026", "GENERAL_SEATING_2026", "PREFERRED_SEATING_2026", "HOUSING_GENERAL_2026", "SPECIAL_GIFT_2026", "CONVENTION_BADGE_2026", "PRINTED_PROGRAM_INCLUDED_2026", "COMMUNITY_DISCOUNTS_2026"],
  GENERAL_REGISTRATION_2026: ["CONVOCATION_SERVICE_ACCESS_2026", "GENERAL_SEATING_2026", "HOUSING_GENERAL_2026", "SPECIAL_GIFT_2026", "CONVENTION_BADGE_2026", "COMMUNITY_DISCOUNTS_2026"],
  JUNIOR_REGISTRATION_GUEST_2026: ["JUNIOR_GUARDIAN_SERVICE_ACCESS_2026", "JUNIOR_GUARDIAN_SEATING_2026", "SPECIAL_GIFT_2026", "CHILD_IDENTIFYING_BADGE_2026"],
  TWO_NIGHT_EXPERIENCE_PASS_2026: ["HOUSING_TWO_NIGHT_2026", "DIGITAL_PROGRAM_2026"],
};

const registrationPolicyContent = `2026 Holy Convocation Registration Acknowledgment

Please review this acknowledgment before submitting registration for the 118th Holy Convocation.

1. Registration information. I confirm that the attendee and group information I provide is accurate. I am authorized to submit registration information for each person in my registration group.

2. Registration products. Each attendee must be assigned an available registration product. Junior Registration Guest is limited to children ages 5 through 17 on November 3, 2026 and requires a verified guardian in the same registration group.

3. Payment and confirmation. A paid registration is confirmed only after secure payment processing is completed and the payment confirmation is received by COGIC LIVE. A pending or submitted registration is not a confirmed registration.

4. Housing. Hotel and housing choices are separate from the registration payment. A housing preference or request is not a hotel reservation or confirmation. Any hotel deposit or room charge is handled separately by the selected hotel or housing process.

5. Credentials and access. Individual registration credentials are issued after a registration is confirmed. Access remains subject to the attendee's assigned registration product and applicable program rules.
`;

const registrationPolicy = {
  version: "2026.1",
  title: "2026 Holy Convocation Registration Acknowledgment",
  content: registrationPolicyContent,
  content_hash: createHash("sha256").update(registrationPolicyContent).digest("hex"),
  effective_at: "2026-08-10T00:00:00.000Z",
};

for (const row of entitlements) {
  const { error } = await db.from("access_entitlements").upsert({ program_key: programKey, ...row }, { onConflict: "program_key,entitlement_key" });
  requireOk(`entitlement ${row.entitlement_key}`, error);
}
for (const row of products) {
  const { error } = await db.from("registration_products").upsert({ program_key: programKey, registration_opens_at: null, registration_closes_at: null, capacity: null, ...row }, { onConflict: "program_key,product_key" });
  requireOk(`product ${row.product_key}`, error);
}
const [{ data: entitlementRows, error: entitlementError }, { data: productRows, error: productError }] = await Promise.all([
  db.from("access_entitlements").select("id,entitlement_key").eq("program_key", programKey),
  db.from("registration_products").select("id,product_key").eq("program_key", programKey),
]);
requireOk("load entitlements", entitlementError);
requireOk("load products", productError);
const entitlementIds = Object.fromEntries(entitlementRows.map((row) => [row.entitlement_key, row.id]));
const productIds = Object.fromEntries(productRows.map((row) => [row.product_key, row.id]));
for (const [productKey, keys] of Object.entries(assignmentKeys)) for (const key of keys) {
  const { error } = await db.from("registration_product_entitlements").upsert({ registration_product_id: productIds[productKey], entitlement_id: entitlementIds[key], quantity: 1, active: true, rule_config: {} }, { onConflict: "registration_product_id,entitlement_id" });
  requireOk(`assignment ${productKey}/${key}`, error);
}

const { data: publishedPolicies, error: publishedPoliciesError } = await db
  .from("registration_policies")
  .select("id,version,status")
  .eq("program_key", programKey)
  .eq("status", "published");
requireOk("load published registration policies", publishedPoliciesError);
if ((publishedPolicies ?? []).length === 0) {
  const { data: existingPolicy, error: existingPolicyError } = await db
    .from("registration_policies")
    .select("id,status")
    .eq("program_key", programKey)
    .eq("version", registrationPolicy.version)
    .maybeSingle();
  requireOk("load registration policy version", existingPolicyError);
  if (existingPolicy && existingPolicy.status !== "draft") throw new Error(`registration policy ${registrationPolicy.version} is not publishable from status ${existingPolicy.status}`);
  const policyPayload = { program_key: programKey, ...registrationPolicy, status: "published", published_at: new Date().toISOString() };
  const policyOperation = existingPolicy
    ? db.from("registration_policies").update(policyPayload).eq("id", existingPolicy.id).eq("status", "draft")
    : db.from("registration_policies").insert(policyPayload);
  const { error: policyError } = await policyOperation;
  requireOk("publish registration policy", policyError);
}

if (!registrationOnly) {
const hotels = [
  { name: "Hilton Pennywell St. Louis at the Arch", address_line_1: "400 Olive St.", postal_code: "63102", website_url: "https://www.hilton.com/en/hotels/stlddhf-hilton-pennywell-st-louis-at-the-arch/", display_order: 10 },
  { name: "Hotel Saint Louis, Autograph Collection", address_line_1: "705 Olive Street", postal_code: "63101", website_url: "https://www.marriott.com/en-us/hotels/stlak-hotel-saint-louis-autograph-collection/overview/", display_order: 20 },
  { name: "Hampton Inn Gateway Arch", address_line_1: "333 Washington Avenue", postal_code: "63102", website_url: "https://www.hilton.com/en/hotels/stldwhx-hampton-st-louis-downtown-at-the-gateway-arch/", display_order: 30 },
  { name: "Hilton St. Louis Ballpark", address_line_1: "1 South Broadway", postal_code: "63102", website_url: "https://www.hilton.com/en/hotels/stlbvhh-hilton-st-louis-at-the-ballpark/", display_order: 40 },
  { name: "21C Museum Hotel St. Louis", address_line_1: "1528 Locust Street", postal_code: "63103", website_url: "https://21cmuseumhotels.com/st-louis/", display_order: 50 },
];
for (const hotel of hotels) {
  const { error } = await db.from("housing_hotels").upsert({ program_key: programKey, city: "St. Louis", state: "Missouri", active: true, ...hotel }, { onConflict: "program_key,name" });
  requireOk(`hotel ${hotel.name}`, error);
}
const { data: hotelRows, error: hotelError } = await db.from("housing_hotels").select("id,name").eq("program_key", programKey);
requireOk("load hotels", hotelError);
const hotelIds = Object.fromEntries(hotelRows.map((row) => [row.name, row.id]));
const sixNight = hotels.map((hotel) => hotel.name);
const fourNight = ["Hilton St. Louis Ballpark", "21C Museum Hotel St. Louis"];
for (const [name, names, minimumNights, latestArrival] of [["General 6 Night Minimum", sixNight, 6, "2026-11-04"], ["General 4 Night Minimum", fourNight, 4, "2026-11-05"]]) for (const hotelName of names) {
  const { error } = await db.from("housing_blocks").upsert({ program_key: programKey, hotel_id: hotelIds[hotelName], eligibility_entitlement_id: entitlementIds.HOUSING_GENERAL_2026, name, minimum_nights: minimumNights, maximum_nights: null, earliest_arrival: null, latest_arrival: latestArrival, request_opens_at: null, request_closes_at: null, inventory_mode: "REQUEST_ONLY", capacity: null, occupancy_options: ["Single", "Double", "Triple", "Quad"], deposit_notice: "First night's room and tax are charged separately by the selected hotel.", active: true, display_order: minimumNights === 6 ? 10 : 20 }, { onConflict: "program_key,hotel_id,name" });
  requireOk(`housing block ${name}/${hotelName}`, error);
}

for (const zone of [{ zone_key: "GENERAL_ENTRY", name: "General Entry" }, { zone_key: "PREFERRED_SEATING", name: "Preferred Seating" }, { zone_key: "MUSICAL_ENTRY", name: "Musical Entry" }]) {
  const { error } = await db.from("access_zones").upsert({ program_key: programKey, ...zone, active: true }, { onConflict: "program_key,zone_key" });
  requireOk(`zone ${zone.zone_key}`, error);
}
}

console.log(JSON.stringify({ products: products.length, entitlements: entitlements.length, assignments: Object.values(assignmentKeys).flat().length, productsPublished: products.filter((product) => product.active && product.public).length, policiesPublished: (publishedPolicies ?? []).length || 1, registrationOnly, occurrencesCreated: 0, staffAssigned: 0 }, null, 2));
