import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  isAllowedAnnouncementCtaHref,
  isAnnouncementAudience,
  isAnnouncementPriority,
  isAnnouncementStatus,
} from "@/lib/announcements/types";
import { parseAnnouncementWriteInput } from "@/lib/announcements/input";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("announcements / updates contracts", () => {
  it("exposes owner and attendee surfaces with real APIs", () => {
    assert.equal(fs.existsSync(path.join(root, "app/updates/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/owner/announcements/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/api/announcements/route.ts")), true);
    assert.equal(fs.existsSync(path.join(root, "app/api/announcements/unread/route.ts")), true);
    assert.equal(
      fs.existsSync(path.join(root, "app/api/announcements/[id]/read/route.ts")),
      true,
    );
    assert.equal(fs.existsSync(path.join(root, "app/api/owner/announcements/route.ts")), true);
    assert.equal(
      fs.existsSync(path.join(root, "app/api/owner/announcements/[id]/route.ts")),
      true,
    );
  });

  it("wires dashboard card and bell to /updates with real unread endpoint", () => {
    const desktop = read("components/dashboard/DesktopDashboardHome.tsx");
    const card = read("components/dashboard/AnnouncementsCard.tsx");
    const bell = read("components/dashboard/AnnouncementBell.tsx");
    const topBar = read("components/dashboard/DashboardTopBar.tsx");
    assert.match(desktop, /AnnouncementsCard/);
    assert.match(card, /href="\/updates"/);
    assert.match(card, /\/api\/announcements\/unread/);
    assert.match(bell, /\/api\/announcements\/unread/);
    assert.match(bell, /\/updates/);
    assert.match(topBar, /AnnouncementBell/);
    assert.doesNotMatch(card, /3 unread|fake|demo/i);
  });

  it("owner nav exposes announcements", () => {
    const menu = read("components/owner/OwnerProductionSideMenu.tsx");
    assert.match(menu, /\/owner\/announcements/);
    assert.match(menu, /id:\s*"announcements"/);
  });

  it("owner APIs require owner auth and refuse public draft visibility", () => {
    const ownerList = read("app/api/owner/announcements/route.ts");
    const ownerPatch = read("app/api/owner/announcements/[id]/route.ts");
    const publicList = read("app/api/announcements/route.ts");
    const published = read("lib/announcements/published-query.ts");

    for (const source of [ownerList, ownerPatch]) {
      assert.match(source, /requireOwnerUser/);
    }
    assert.match(publicList, /listVisibleAnnouncements/);
    assert.match(published, /status\",\s*\"published\"|eq\(\"status\", \"published\"\)/);
    assert.match(published, /syncAnnouncementLifecycle/);
    assert.doesNotMatch(published, /status\",\s*\"draft\"/);
  });

  it("validates CTA allowlist and lifecycle enums", () => {
    assert.equal(isAllowedAnnouncementCtaHref("/live"), true);
    assert.equal(isAllowedAnnouncementCtaHref("https://evil.example"), false);
    assert.equal(isAnnouncementStatus("draft"), true);
    assert.equal(isAnnouncementStatus("published"), true);
    assert.equal(isAnnouncementPriority("urgent"), true);
    assert.equal(isAnnouncementAudience("registered_attendees"), true);

    assert.throws(
      () =>
        parseAnnouncementWriteInput({
          title: "Hello",
          body: "Body",
          ctaHref: "https://evil.example",
          ctaLabel: "Go",
        }),
      /approved internal route/,
    );

    const ok = parseAnnouncementWriteInput({
      title: "Hello",
      body: "Body text",
      category: "schedule",
      priority: "important",
      audience: "all_authenticated",
      pinned: true,
      ctaHref: "/program",
      ctaLabel: "View Schedule",
    });
    assert.equal(ok.ctaHref, "/program");
    assert.equal(ok.priority, "important");
  });

  it("migration defines announcements + reads without seed rows", () => {
    const sql = read("supabase/migrations/20260806180000_announcements_and_manual_media.sql");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.announcements/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.announcement_reads/);
    assert.match(sql, /status = 'published'/);
    assert.doesNotMatch(sql, /INSERT INTO public\.announcements/i);
  });

  it("attendee feed and owner UI avoid mock/demo content", () => {
    const feed = read("components/updates/AnnouncementsFeed.tsx");
    const ownerUi = read("components/owner/AnnouncementManagementClient.tsx");
    assert.match(feed, /\/api\/announcements/);
    assert.match(feed, /No updates published/);
    assert.match(ownerUi, /\/api\/owner\/announcements/);
    assert.doesNotMatch(feed, /demo update|sample announcement|fake/i);
    assert.doesNotMatch(ownerUi, /demo|fake announcement/i);
  });

  it("parity rule is documented in implementation standards", () => {
    const docs = read("docs/IMPLEMENTATION_STANDARD.md");
    const rule = read(".cursor/rules/implementation-standard.mdc");
    assert.match(docs, /ADMIN \/ USER PARITY RULE/);
    assert.match(rule, /ADMIN \/ USER PARITY/);
  });
});
