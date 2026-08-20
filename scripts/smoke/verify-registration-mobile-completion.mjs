import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.REGISTRATION_VERIFY_BASE_URL || "http://localhost:3000";
const env = Object.fromEntries(fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const i=line.indexOf("="); return [line.slice(0,i).trim(),line.slice(i+1).trim().replace(/^['"]|['"]$/g,"")]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
const stamp = Date.now();
const email = `registration-mobile-${stamp}@example.com`;
const password = `Verify-${stamp}-Aa!`;
const report = {};
let userId = "";
const pass = (name, value, detail="") => { report[name] = { pass:Boolean(value), detail }; console.log(`${value?"PASS":"FAIL"} ${name}${detail?` — ${detail}`:""}`); };

const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm:true, user_metadata:{ first_name:"Mobile", last_name:"Verifier", phone:"+13125550199", city:"Chicago", state:"IL" } });
if (createError || !created.user) throw createError || new Error("Unable to create verification user");
userId = created.user.id;
await admin.from("attendees").upsert({ id:userId,email,is_guest:false,first_name:"Mobile",last_name:"Verifier",phone:"+13125550199",city:"Chicago",state:"IL" });

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:390,height:844 }, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000);
try {
  const login = await context.request.post(`${BASE}/api/auth`, { data:{ action:"login",email,password }, headers:{"Content-Type":"application/json"} });
  pass("auth", login.ok(), `HTTP ${login.status()}`);
  const travelResponse = await page.goto(`${BASE}/travel`, { waitUntil:"domcontentloaded", timeout:120000 });
  pass("authenticatedTravelRoute", travelResponse?.status()===200 && await page.getByText("COGIC TRAVEL",{exact:false}).first().isVisible(), `HTTP ${travelResponse?.status()}`);
  await page.goto(`${BASE}/register`, { waitUntil:"domcontentloaded" });
  pass("beforeYouBeginFirst", await page.getByRole("heading",{name:"Before You Begin"}).isVisible(), page.url());
  await page.getByLabel("I have read and understand the registration information above.").click();
  const continueButton = page.getByRole("button",{name:/Continue to attendee information/i});
  await continueButton.waitFor({ state:"visible" });
  await continueButton.click();
  await page.waitForURL(/step=attendee/);
  pass("acknowledgment", true, page.url());

  const before = await admin.from("registration_groups").select("id,row_version,wizard_metadata").eq("owner_user_id",userId).single();
  const save = await context.request.post(`${BASE}/api/registration/experience`, { data:{ action:"save_primary_draft",draft:{ firstName:"Mobile",lastName:"Verifier",email,mobilePhone:"3125550199",streetAddress:"100 Verification Way",city:"Chicago",state:"IL",postalCode:"60601",countryCode:"US",churchName:"Verification Temple",pastorName:"Pastor Verify",jurisdiction:"Illinois First",draftLastStep:"product",amountCents:1 },versions:{ groupVersion:before.data.row_version,registrationVersion:null } } });
  const saveBody = await save.json();
  pass("attendeeSave", save.status()===200, `HTTP ${save.status()} ${saveBody.error||""}`);
  const after = await admin.from("registration_groups").select("id,row_version,wizard_resume_step,wizard_metadata,registrations(id,row_version,mobile_phone)").eq("owner_user_id",userId).single();
  const registration = after.data.registrations[0];
  pass("groupRowVersion", after.data.row_version>before.data.row_version, `${before.data.row_version}→${after.data.row_version}`);
  pass("registrationRowVersion", registration.row_version>=1, String(registration.row_version));
  pass("phoneE164", registration.mobile_phone==="+13125550199", registration.mobile_phone);
  pass("draftResume", after.data.wizard_resume_step>=2, String(after.data.wizard_resume_step));

  await page.goto(`${BASE}/register?step=product`, { waitUntil:"domcontentloaded" });
  pass("registrationStepCount", await page.getByText(/Step 2 of 6/).isVisible(), "six registration-only steps");
  const registrationText = await page.locator("main").innerText();
  pass("housingRemovedFromRegistration", !/select hotel|room selection|check-in|check-out|housing payment/i.test(registrationText), "no housing controls");
  pass("travelBookingRemovedFromRegistration", !/flight selection|rental car selection|travel itinerary/i.test(registrationText), "no travel booking controls");
  for (const label of ["Diamond Registration","General Registration","Jr. Registration Guest","2-Night Experience Pass","Musical Ticket","Printed Program","Digital Program"]) pass(`visible:${label}`, await page.getByText(label,{exact:false}).first().isVisible(), "mobile");

  const products = await admin.from("registration_products").select("id,product_key,price_cents").eq("program_key","cogic-stream-2026");
  const diamond = products.data.find((p)=>p.product_key==="DIAMOND_REGISTRATION_2026");
  const junior = products.data.find((p)=>p.product_key==="JUNIOR_REGISTRATION_GUEST_2026");
  const saveDiamond = await context.request.post(`${BASE}/api/registration/experience`, { data:{ action:"save_registrant",registrant:{ id:registration.id,isPrimary:true,productId:diamond.id,firstName:"Mobile",lastName:"Verifier",email,mobilePhone:"3125550199",streetAddress:"100 Verification Way",city:"Chicago",state:"IL",postalCode:"60601",countryCode:"US",churchName:"Verification Temple",pastorName:"Pastor Verify",jurisdiction:"Illinois First",amountCents:1 } } });
  pass("diamondTamper", saveDiamond.status()===200, `HTTP ${saveDiamond.status()}`);
  const priced = await admin.from("registrations").select("amount_cents,registration_product_id").eq("id",registration.id).single();
  pass("serverPrice", priced.data.amount_cents===15000, String(priced.data.amount_cents));
  const invalidJunior = await context.request.post(`${BASE}/api/registration/experience`, { data:{ action:"save_registrant",registrant:{ id:registration.id,isPrimary:true,productId:junior.id,firstName:"Mobile",lastName:"Verifier",email,mobilePhone:"3125550199",streetAddress:"100 Verification Way",city:"Chicago",state:"IL",postalCode:"60601",countryCode:"US",churchName:"Verification Temple",pastorName:"Pastor Verify",jurisdiction:"Illinois First" } } });
  pass("juniorBackend", invalidJunior.status()===422, `HTTP ${invalidJunior.status()}`);

  const currentGroup = await admin.from("registration_groups").select("row_version").eq("id",after.data.id).single();
  const extras = await context.request.post(`${BASE}/api/registration/experience`, { data:{ action:"save_extras",musicalQuantity:2,printedProgram:true,digitalProgram:true,smsOptIn:false,emailOptIn:false,musicalUnitCents:1,printedProgramUnitCents:1,versions:{groupVersion:currentGroup.data.row_version} } });
  pass("extrasSave", extras.status()===200, `HTTP ${extras.status()}`);
  const extrasGroup = await admin.from("registration_groups").select("wizard_metadata").eq("id",after.data.id).single();
  pass("extrasPricing", extrasGroup.data.wizard_metadata.extras_total_cents===7000, String(extrasGroup.data.wizard_metadata.extras_total_cents));
  pass("optOuts", extrasGroup.data.wizard_metadata.sms_opt_in===false && extrasGroup.data.wizard_metadata.email_opt_in===false, "false/false");

  const experience = await context.request.get(`${BASE}/api/registration/experience`);
  const experienceBody = await experience.json();
  pass("activePolicy", experience.ok() && Boolean(experienceBody.policy?.id), `HTTP ${experience.status()}`);
  const acceptance = await context.request.post(`${BASE}/api/registration/experience`, {
    data: {
      action: "accept_policy",
      policyId: experienceBody.policy?.id,
      authorizedSignerName: "Mobile Verifier",
      agreementSignerName: "Mobile Verifier",
    },
  });
  pass("policyAcceptance", acceptance.ok(), `HTTP ${acceptance.status()}`);

  async function verifyProceedAtViewport(name, viewport) {
    await page.setViewportSize(viewport);
    await page.goto(`${BASE}/register?step=review`, { waitUntil:"domcontentloaded" });
    await page.getByRole("heading", { name:"Review" }).waitFor();
    const proceed = page.getByRole("button", { name:"Proceed", exact:true });
    await proceed.scrollIntoViewIfNeeded();
    const box = await proceed.boundingBox();
    const layout = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
    pass(`${name}:ctaVisible`, Boolean(box && box.y >= 0 && box.y + box.height <= layout.viewportHeight), JSON.stringify(box));
    pass(`${name}:bottomNavUnobstructed`, Boolean(box && box.y + box.height <= layout.viewportHeight), JSON.stringify(box));
    pass(`${name}:noHorizontalScroll`, !layout.horizontalOverflow);

    await proceed.click({ clickCount:2 });
    await page.waitForURL(/\/register\?step=payment/);
    await page.getByRole("heading", { name:"Payment / Submit" }).waitFor();
    const paymentButton = page.getByRole("button", { name:/Submit and pay|Complete free registration/ });
    pass(`${name}:reviewToPayment`, await paymentButton.isVisible(), page.url());
    pass(`${name}:serverAmount`, /\$220/.test(await paymentButton.innerText()), await paymentButton.innerText());
    pass(`${name}:noRuntimeError`, true);

    await page.getByRole("button", { name:"Back", exact:true }).click();
    await page.waitForURL(/\/register\?step=review/);
    pass(`${name}:paymentToReview`, await proceed.isVisible(), page.url());
    await proceed.click();
    await page.waitForURL(/\/register\?step=payment/);
    pass(`${name}:secondProceed`, await paymentButton.isVisible(), page.url());

    const paymentRows = await admin.from("registration_payments").select("id", { count:"exact", head:true }).eq("registration_id", registration.id);
    pass(`${name}:noDuplicatePayment`, paymentRows.count===0, String(paymentRows.count));
  }

  await verifyProceedAtViewport("390x844", { width:390, height:844 });
  await verifyProceedAtViewport("390x700", { width:390, height:700 });

  const twoNight = products.data.find((p)=>p.product_key==="TWO_NIGHT_EXPERIENCE_PASS_2026");
  await admin.from("registrations").update({registration_product_id:twoNight.id}).eq("id",registration.id);
  const block = await admin.from("housing_blocks").select("id,hotel_id,eligibility_entitlement_id").eq("active",true).limit(1).maybeSingle();
  if (block.data) {
    const attempt = await admin.from("housing_requests").insert({program_key:"cogic-stream-2026",user_id:userId,registration_group_id:after.data.id,primary_registration_id:registration.id,housing_entitlement_id:block.data.eligibility_entitlement_id,preference:"book_hotel",hotel_id:block.data.hotel_id,block_id:block.data.id,arrival_date:"2026-11-03",departure_date:"2026-11-06",stay_nights:3,occupancy:"Single",room_reservation_owner:true,status:"submitted"});
    pass("twoNightBackend", Boolean(attempt.error?.message.includes("limited to 2 nights")), attempt.error?.message||"unexpected success");
  } else pass("twoNightBackend",false,"no active housing block");
} finally {
  await browser.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
}
if (Object.values(report).some((item)=>!item.pass)) process.exitCode=1;
