import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("registration and travel remain separate while official housing is server gated",()=>{
  const wizard=read("components/registration/RegistrationSlice2Experience.tsx");
  const milestones=read("lib/registration/group-experience.ts");
  const eligibility=read("lib/travel/registration-eligibility.ts");
  const travel=read("app/travel/page.tsx")+read("components/travel/HotelSearchPanel.tsx");
  const checkout=read("lib/travel/checkout/create-intent.ts");
  const search=read("app/api/travel/marketplace/hotels/search/route.ts");
  assert.doesNotMatch(wizard,/HousingExperience|hotel selection|room selection/i);
  assert.doesNotMatch(milestones,/id: "housing"/);
  assert.match(eligibility,/eq\("status", "confirmed"\)/);
  assert.match(eligibility,/select\("registration_product_id,registration_products\(product_key,name\)"\)/);
  assert.match(eligibility,/from\("registration_product_entitlements"\)/);
  assert.doesNotMatch(eligibility,/registration_products\(product_key,name\),registration_product_entitlements/);
  assert.match(eligibility,/entitlement_type", "housing"/);
  assert.match(eligibility,/limited to 2 nights/);
  assert.match(travel,/registration is required before accessing official convention housing/i);
  assert.match(travel,/Register Now/);
  assert.match(checkout,/assertHotelStayEligible/);
  assert.match(search,/assertHotelStayEligible/);
});
