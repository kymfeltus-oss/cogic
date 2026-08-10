import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONNECT_MAX_BODY_LENGTH,
  CONNECT_MAX_MEDIA,
} from "@/lib/social/connect-types";
import { DM_MAX_BODY_LENGTH } from "@/lib/social/dms-types";
import {
  connectMediaTypeFromMime,
  isAllowedConnectMediaMime,
} from "@/lib/social/connect-media";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("COGIC Connect retarget contracts", () => {
  it("keeps Live Chat on chat_messages while Connect uses dedicated tables", () => {
    const liveChat = read("app/api/live/chat/route.ts");
    const fellowship = read("app/api/experience/fellowship-chat/route.ts");
    const posts = read("app/api/social/posts/route.ts");
    const seed = read("app/api/live/seeds/sow/route.ts");

    assert.match(liveChat, /chat_messages/);
    assert.match(fellowship, /insertFellowshipChatMessage|loadFellowshipChatFeed/);
    assert.match(posts, /connect_posts|createConnectPost|loadConnectFeedPayload/);
    assert.match(seed, /insertFellowshipChatMessage/);
    assert.doesNotMatch(posts, /chat_messages/);
  });

  it("exposes Connect feed, media upload, DMs, reports, and owner moderation APIs", () => {
    for (const relative of [
      "app/api/social/posts/route.ts",
      "app/api/social/posts/react/route.ts",
      "app/api/social/media/route.ts",
      "app/api/social/dms/route.ts",
      "app/api/social/reports/route.ts",
      "app/api/owner/social/route.ts",
      "app/owner/social/page.tsx",
      "components/owner/ConnectModerationClient.tsx",
      "components/social/DMOverlayPopup.tsx",
      "components/social/SocialCommunityClient.tsx",
      "supabase/migrations/20260810190000_cogic_connect_decouple.sql",
    ]) {
      assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
    }
  });

  it("owner social and reports target connect_* tables", () => {
    const owner = read("app/api/owner/social/route.ts");
    const reports = read("app/api/social/reports/route.ts");
    const client = read("components/social/SocialCommunityClient.tsx");
    const dmOverlay = read("components/social/DMOverlayPopup.tsx");
    const hook = read("lib/social/useConnectFeed.ts");

    assert.match(owner, /connect_posts/);
    assert.match(owner, /connect_user_mutes/);
    assert.match(owner, /connect_post_reports/);
    assert.doesNotMatch(owner, /chat_messages/);
    assert.doesNotMatch(owner, /chat_room_mutes/);
    assert.doesNotMatch(owner, /chat_message_reports/);

    assert.match(reports, /connect_posts/);
    assert.match(reports, /connect_post_reports/);
    assert.doesNotMatch(reports, /chat_message_reports/);

    assert.match(hook, /\/api\/social\/posts/);
    assert.match(hook, /connect_posts/);
    assert.match(dmOverlay, /\/api\/social\/dms/);
    assert.match(dmOverlay, /direct_messages/);
    assert.match(dmOverlay, /createRealtimeChannel/);
    assert.match(client, /DMOverlayPopup/);
    assert.match(client, /cogic-social__layout--single/);
    assert.match(client, /reactToPost|\/api\/social\/posts\/react/);

    const reactRoute = read("app/api/social/posts/react/route.ts");
    assert.match(reactRoute, /toggleConnectReaction|connect_post_reactions/);
    assert.doesNotMatch(reactRoute, /increment_post_counter|reaction_type/);

    const ownerPage = read("app/owner/social/page.tsx");
    const ownerMenu = read("components/owner/OwnerProductionSideMenu.tsx");
    const ownerClient = read("components/owner/ConnectModerationClient.tsx");
    assert.match(ownerPage, /ConnectModerationClient/);
    assert.match(ownerMenu, /\/owner\/social/);
    assert.match(ownerClient, /\/api\/owner\/social/);
    assert.match(ownerClient, /dismiss_report|resolve_report|set_posting/);
  });

  it("enforces Connect and DM body/media limits", () => {
    assert.equal(CONNECT_MAX_BODY_LENGTH, 200);
    assert.equal(CONNECT_MAX_MEDIA, 4);
    assert.equal(DM_MAX_BODY_LENGTH, 200);
    assert.equal(isAllowedConnectMediaMime("image/png"), true);
    assert.equal(isAllowedConnectMediaMime("video/mp4"), true);
    assert.equal(isAllowedConnectMediaMime("application/pdf"), false);
    assert.equal(connectMediaTypeFromMime("image/jpeg"), "image");
    assert.equal(connectMediaTypeFromMime("video/webm"), "video");

    const migration = read("supabase/migrations/20260810190000_cogic_connect_decouple.sql");
    assert.match(migration, /BETWEEN 1 AND 200/);
    assert.match(migration, /direct_messages/);
    assert.match(migration, /connect-media/);
  });

  it("DM API writes message_body / media_urls / read_at schema", () => {
    const dms = read("app/api/social/dms/route.ts");
    const server = read("lib/social/dms-server.ts");
    assert.match(dms, /loadDmInbox|sendDirectMessage/);
    assert.match(server, /message_body/);
    assert.match(server, /media_urls/);
    assert.match(server, /read_at/);
    assert.doesNotMatch(server, /read_status:/);
  });
});
