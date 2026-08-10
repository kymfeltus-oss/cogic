import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { resolveAttendeeMediaState } from "@/lib/live/attendee-media-state";
import {
  registrationHeadline,
  summarizeHousing,
  summarizeTickets,
} from "@/lib/dashboard/dashboard-module-summaries";
import type { DashboardRegistrationState } from "@/lib/dashboard/load-attendee-dashboard";

const root = process.cwd();
const read = (relativePath: string) => readFile(path.join(root, relativePath), "utf8");

const baseRegistration = (
  overrides: Partial<DashboardRegistrationState> = {},
): DashboardRegistrationState => ({
  status: "none",
  credentialReady: false,
  productName: null,
  groupSize: 0,
  policyAccepted: false,
  registrationId: null,
  registeredAt: null,
  paymentStatus: null,
  policy: null,
  members: [],
  ...overrides,
});

test("1 no-registration dashboard state", () => {
  const state = registrationHeadline(baseRegistration(), true);
  assert.equal(state.title, "No Registration");
  assert.equal(state.cta, "Register");
});

test("2 draft registration state", () => {
  const state = registrationHeadline(baseRegistration({ status: "draft" }), true);
  assert.equal(state.title, "Registration In Progress");
  assert.equal(state.cta, "Continue Registration");
});

test("3 payment-pending state", () => {
  const state = registrationHeadline(baseRegistration({ status: "payment_pending" }), true);
  assert.equal(state.title, "Payment Pending");
  assert.equal(state.cta, "Complete Payment");
});

test("4 confirmed registration state", () => {
  const state = registrationHeadline(
    baseRegistration({ status: "confirmed", credentialReady: false }),
    true,
  );
  assert.equal(state.title, "Registration Confirmed");
  assert.match(state.summary, /Credential pending/i);
});

test("5 issued credential state", () => {
  const state = registrationHeadline(
    baseRegistration({ status: "confirmed", credentialReady: true }),
    true,
  );
  assert.equal(state.title, "Registration Confirmed");
  assert.match(state.summary, /credential is ready/i);
});

test("6 credential secure CTA reuses presentation API", async () => {
  const card = await read("components/dashboard/MyConvocationCard.tsx");
  assert.match(card, /\/api\/registration\/credential-presentation/);
  assert.match(card, /Show Credential|View Credential|qrDataUrl/);
  assert.doesNotMatch(card, /secure_token|token_hash|raw token/i);
});

test("7 ticket empty state from real zero rows", () => {
  const summary = summarizeTickets({ validCount: 0, revokedCount: 0 });
  assert.equal(summary.summary, "No issued event tickets.");
});

test("8 real ticket state", () => {
  const summary = summarizeTickets({
    validCount: 2,
    revokedCount: 0,
    nearestTitle: "Midnight Musical",
  });
  assert.match(summary.summary, /2 issued tickets/);
  assert.match(summary.summary, /Midnight Musical/);
});

test("9 housing empty state from real zero rows", () => {
  const summary = summarizeHousing({});
  assert.equal(summary.summary, "No housing preference submitted.");
});

test("10 own accommodations state", () => {
  const summary = summarizeHousing({ preference: "own_accommodations" });
  assert.equal(summary.summary, "Own accommodations selected.");
});

test("11 sharing-room state", () => {
  const summary = summarizeHousing({ preference: "sharing_room" });
  assert.equal(summary.summary, "Sharing a room selected.");
});

test("12 housing request state", () => {
  const summary = summarizeHousing({
    preference: "book_hotel",
    status: "pending",
    hotelName: "Marriott",
    arrival: "2026-11-01",
    departure: "2026-11-07",
  });
  assert.match(summary.summary, /Marriott/);
  assert.match(summary.summary, /pending/i);
});

test("13 live state", () => {
  const media = resolveAttendeeMediaState(true, null);
  assert.equal(media.kind, "live");
  assert.equal(media.badge, "LIVE NOW");
  assert.equal(media.cta, "WATCH LIVE");
});

test("14 replay state", () => {
  const media = resolveAttendeeMediaState(false, {
    playbackUrl: "https://cdn.example/replay.mp4",
  });
  assert.equal(media.kind, "replay");
  assert.equal(media.badge, "PLAYING NOW");
});

test("15 true offline state", () => {
  const media = resolveAttendeeMediaState(false, null);
  assert.equal(media.kind, "offline");
  assert.equal(media.badge, "OFFLINE");
  assert.equal(media.cta, null);
});

test("16 no forced preview", async () => {
  const [stage, media] = await Promise.all([
    read("components/dashboard/DashboardLiveStage.tsx"),
    read("lib/live/attendee-media-state.ts"),
  ]);
  assert.doesNotMatch(stage, /resolveAttendeeMediaState\([^)]*,\s*true\)/);
  assert.match(media, /hasPlayablePreview = false/);
  const offline = resolveAttendeeMediaState(false, null, false);
  assert.equal(offline.kind, "offline");
});

test("17 schedule real data wired", async () => {
  const [home, loader] = await Promise.all([
    read("components/dashboard/AttendeeDashboardHome.tsx"),
    read("lib/dashboard/load-attendee-dashboard.ts"),
  ]);
  assert.match(home, /TodayScheduleCard/);
  assert.match(loader, /getChicagoLocalDate|America\/Chicago|getPublishedOccurrences/);
  assert.match(loader, /todayOccurrences/);
});

test("18 schedule truthful empty", async () => {
  const card = await read("components/dashboard/TodayScheduleCard.tsx");
  assert.match(card, /No events are scheduled today/);
});

test("19 signed-out personalized-data isolation", async () => {
  const [tickets, housing, loader] = await Promise.all([
    read("lib/dashboard/load-dashboard-tickets.ts"),
    read("lib/dashboard/load-dashboard-housing.ts"),
    read("lib/dashboard/load-attendee-dashboard.ts"),
  ]);
  assert.match(tickets, /if \(!userId\)/);
  assert.match(tickets, /Sign in to view your tickets/);
  assert.match(housing, /if \(!userId\)/);
  assert.match(housing, /Sign in to view your housing/);
  assert.match(loader, /userId \? getRegistrationForUser/);
});

test("20 loading state", async () => {
  const [page, loading] = await Promise.all([
    read("app/my-convocation/page.tsx"),
    read("components/dashboard/DashboardLoading.tsx"),
  ]);
  assert.match(page, /Suspense fallback=\{<DashboardLoading/);
  assert.match(loading, /Loading your Convocation/);
  assert.doesNotMatch(page, /fallback=\{null\}/);
});

test("21 localized error state", async () => {
  const home = await read("components/dashboard/AttendeeDashboardHome.tsx");
  assert.match(home, /Unable to load registration\. Try again\./);
  assert.match(home, /Unable to load schedule\. Try again\./);
  assert.match(home, /data\.tickets\.error/);
  assert.match(home, /data\.housing\.error/);
});

test("22 no highlight operational placeholders", async () => {
  const home = await read("components/dashboard/AttendeeDashboardHome.tsx");
  assert.doesNotMatch(home, /highlightPlaceholders/);
  assert.match(home, /recentReplays\.length > 0/);
  assert.match(home, /Browse the published schedule|Open live programming/);
});

test("23 COGIC Connect not redirecting falsely to Live", async () => {
  const utilities = await read("lib/dashboard/dashboard-utilities.ts");
  assert.match(utilities, /title:\s*"COGIC Connect"[\s\S]*?href:\s*"\/social"/);
  assert.doesNotMatch(utilities, /COGIC Connect[\s\S]{0,120}\/experience\/live/);
  assert.doesNotMatch(utilities, /COGIC Connect[\s\S]{0,120}href:\s*"\/live"/);
});

test("24 Giving owner parity", async () => {
  const [ownerPage, ownerApi, attendeePage, repo] = await Promise.all([
    read("app/owner/giving/page.tsx"),
    read("app/api/owner/giving/funds/route.ts"),
    read("app/giving/page.tsx"),
    read("lib/giving/repository.ts"),
  ]);
  assert.match(ownerPage, /GivingFundsManagementClient/);
  assert.match(ownerApi, /requireOwnerUser/);
  assert.match(ownerApi, /createGivingFund|updateGivingFund/);
  assert.match(attendeePage, /listActiveGivingFunds/);
  assert.match(repo, /giving_funds/);
});

test("25 dead controls = 0 for Connect and account cards", async () => {
  const [home, utilities] = await Promise.all([
    read("components/dashboard/AttendeeDashboardHome.tsx"),
    read("lib/dashboard/dashboard-utilities.ts"),
  ]);
  assert.match(home, /href=\{ticketsHref\}/);
  assert.match(home, /href=\{housingHref\}/);
  for (const href of [
    "/register",
    "/live",
    "/travel",
    "/giving",
    "/updates",
    "/contact-us",
    "/social",
  ]) {
    assert.match(utilities, new RegExp(href.replace("/", "\\/")));
  }
});

test("26 demo/static operational data = 0", async () => {
  const home = await read("components/dashboard/AttendeeDashboardHome.tsx");
  assert.doesNotMatch(home, /248,930|demo ticket|sample housing|fake schedule/i);
  assert.doesNotMatch(home, /No issued event tickets\."/);
  assert.doesNotMatch(home, /No housing preference submitted\."/);
  assert.match(home, /data\.tickets\.summary/);
  assert.match(home, /data\.housing\.summary/);
});
