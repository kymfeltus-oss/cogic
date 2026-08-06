import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  isAllowedVideoMimeType,
  MEDIA_UPLOAD_BUCKET,
  MEDIA_UPLOAD_MAX_BYTES,
} from "@/lib/media/upload";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("manual video upload contracts", () => {
  it("exposes signed upload session + complete APIs under owner auth", () => {
    assert.equal(
      fs.existsSync(path.join(root, "app/api/owner/media/upload-session/route.ts")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, "app/api/owner/media/upload-complete/route.ts")),
      true,
    );
    const session = read("app/api/owner/media/upload-session/route.ts");
    const complete = read("app/api/owner/media/upload-complete/route.ts");
    assert.match(session, /requireOwnerUser/);
    assert.match(session, /createSignedUploadUrl/);
    assert.match(session, /manual_upload/);
    assert.doesNotMatch(session, /AWS_SECRET|SERVICE_ROLE_KEY|secretAccessKey/);
    assert.match(complete, /upload_status:\s*"ready"/);
    assert.match(complete, /requireOwnerUser/);
  });

  it("rejects invalid mime types and oversize limits in helpers", () => {
    assert.equal(isAllowedVideoMimeType("video/mp4"), true);
    assert.equal(isAllowedVideoMimeType("application/pdf"), false);
    assert.equal(MEDIA_UPLOAD_BUCKET, "media-uploads");
    assert.equal(MEDIA_UPLOAD_MAX_BYTES, 500 * 1024 * 1024);
  });

  it("owner replay UI supports upload progress and direct storage", () => {
    const ui = read("components/owner/ReplayManagementClient.tsx");
    assert.match(ui, /Upload video/);
    assert.match(ui, /\/api\/owner\/media\/upload-session/);
    assert.match(ui, /\/api\/owner\/media\/upload-complete/);
    assert.match(ui, /Upload progress/);
    assert.match(ui, /XMLHttpRequest/);
    assert.doesNotMatch(ui, /AWS_SECRET|service_role|SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("publish requires ready media and unpublish does not delete storage", () => {
    const patch = read("app/api/owner/replays/[recordingId]/route.ts");
    assert.match(patch, /Manual upload must reach ready status before publishing/);
    assert.doesNotMatch(patch, /\.remove\(|storage\.from\(.*\)\.remove/);
    assert.match(patch, /publication_status/);
  });

  it("migration adds provenance columns and media-uploads bucket", () => {
    const sql = read("supabase/migrations/20260806180000_announcements_and_manual_media.sql");
    assert.match(sql, /media_source_type/);
    assert.match(sql, /manual_upload/);
    assert.match(sql, /media-uploads/);
    assert.match(sql, /upload_status/);
  });

  it("uploaded media feeds the same owner/public replay surfaces", () => {
    assert.equal(fs.existsSync(path.join(root, "app/owner/replays/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/replays/page.tsx")), true);
    const menu = read("components/owner/OwnerProductionSideMenu.tsx");
    assert.match(menu, /\/owner\/replays/);
    assert.match(menu, /Media \/ Replays/);
  });
});
