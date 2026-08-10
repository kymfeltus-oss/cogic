import assert from "node:assert/strict";import {describe,it} from "node:test";import fs from "node:fs";import path from "node:path";const root=process.cwd(),read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");describe("COGIC Travel phase contract",()=>{it("shows only published non-archived hotels",()=>{const s=read("lib/travel/repository.ts");assert.match(s,/eq\("published",true\)/);assert.match(s,/eq\("archived",false\)/)});it("keeps provider credentials on the server and gives an honest unavailable state",()=>{assert.match(read("lib/travel/providers.ts"),/import "server-only"/);assert.doesNotMatch(read("components/travel/TravelShell.tsx"),/fake|sample rate|demo inventory/i);assert.match(read("components/travel/TravelShell.tsx"),/never show invented prices or availability/i)});it("integrates registration with optional travel",()=>{const s=read("components/registration/RegistrationPaymentCompleteClient.tsx")+read("components/registration/RegistrationSlice2Experience.tsx");assert.match(s,/Plan My Trip/);assert.match(s,/Do This Later/)});it("implements owner-scoped CRUD and program isolation",()=>{const api=read("app/api/travel/itinerary/route.ts"),migration=read("supabase/migrations/20260807150000_cogic_travel_foundation.sql");assert.match(api,/\.eq\("user_id",u\.id\)/);assert.match(api,/TRAVEL_PROGRAM_KEY/);assert.match(migration,/auth\.uid\(\)=user_id/g);assert.match(migration,/cogic-stream-2026/)});it("does not expose provider secrets to client code",()=>{const client=read("components/owner/TravelManagementClient.tsx")+read("components/travel/MyTripClient.tsx");assert.doesNotMatch(client,/API_KEY|ACCESS_TOKEN|secret/i)});it("defines all required analytics events",()=>{const api=read("app/api/travel/analytics/route.ts");for(const e of ["travel_page_viewed","official_hotel_clicked","travel_flight_search_started","travel_car_search_started","travel_itinerary_added","travel_booking_redirected"])assert.match(api,new RegExp(e))});
it("keeps primary Hotels/Flights/Cars controls as in-page tabs on the travel hub",()=>{
  const page=read("app/travel/page.tsx");
  const hub=read("components/travel/TravelHubClient.tsx");
  const tabs=read("components/travel/TravelModeTabs.tsx");
  assert.match(page,/TravelHubClient/);
  assert.doesNotMatch(page,/href="\/travel\/hotels"/);
  assert.doesNotMatch(page,/href="\/travel\/flights"/);
  assert.doesNotMatch(page,/href="\/travel\/cars"/);
  assert.match(hub,/useState<TravelTab>\("hotels"\)/);
  assert.match(hub,/href="\/travel\/trip"/);
  assert.match(tabs,/role="tablist"/);
  assert.doesNotMatch(tabs,/href=|router\.push|Link /);
  assert.match(read("components/travel/HotelSearchPanel.tsx"),/OfficialHotelsClient/);
  assert.match(read("components/travel/FlightSearchPanel.tsx"),/HonestUnavailable/);
  assert.match(read("components/travel/RentalCarSearchPanel.tsx"),/HonestUnavailable/);
  assert.doesNotMatch(read("components/travel/FlightSearchPanel.tsx")+read("components/travel/RentalCarSearchPanel.tsx"),/fake fare|sample flight|demo inventory|invented/i);
});
it("completes hotel booking into My Trip without fake confirmation",()=>{
  const start=read("app/api/travel/hotel-booking/start/route.ts");
  const trip=read("app/travel/trip/page.tsx");
  const availability=read("components/travel/HotelAvailabilityClient.tsx");
  assert.match(start,/redirectTo:\s*destination/);
  assert.match(start,/\/travel\/trip/);
  assert.doesNotMatch(start,/redirect_destination:\s*"\/housing"|destination="\/housing"/);
  assert.match(start,/login\?next=/);
  assert.match(trip,/MyTripClient/);
  assert.match(availability,/Continue to My Trip/);
  assert.match(availability,/does not confirm|confirmation number/i);
});
it("standalone flights and cars reuse honest search panels",()=>{
  assert.match(read("app/travel/flights/page.tsx"),/FlightSearchPanel/);
  assert.match(read("app/travel/cars/page.tsx"),/RentalCarSearchPanel/);
  assert.doesNotMatch(read("app/travel/flights/page.tsx"),/<input(?![^>]*readOnly)/);
});
it("locks travel hub to the universal mobile shell at every viewport",()=>{
  const css=read("app/travel/travel-home.css");
  assert.match(css,/--ct-mobile-shell-max:\s*430px/);
  assert.match(css,/max-width:\s*var\(--ct-mobile-shell-max\)/);
  assert.match(css,/Mobile-only COGIC Travel/);
  assert.doesNotMatch(css,/@media\s*\(max-width:\s*73rem\)/);
  assert.doesNotMatch(css,/@media\s*\(max-width:\s*48rem\)/);
  assert.match(css,/\.ct-hotel-result-card\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css,/\.ct-secondary-travel\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});
});
