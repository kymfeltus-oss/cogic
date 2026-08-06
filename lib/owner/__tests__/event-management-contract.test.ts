import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("owner event occurrence management contracts", () => {
  it("exposes owner events page and occurrence write APIs", () => {
    assert.equal(fs.existsSync(path.join(root, "app/owner/events/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/api/owner/events/route.ts")), true);
    assert.equal(fs.existsSync(path.join(root, "app/api/owner/occurrences/route.ts")), true);
    assert.equal(
      fs.existsSync(path.join(root, "app/api/owner/occurrences/[occurrenceId]/route.ts")),
      true,
    );
  });

  it("wires side menu to /owner/events", () => {
    const menu = read("components/owner/OwnerProductionSideMenu.tsx");
    assert.match(menu, /\/owner\/events/);
    assert.match(menu, /id:\s*"events"/);
  });

  it("requires owner auth and refuses fabricated defaults for schedule times", () => {
    const eventsApi = read("app/api/owner/events/route.ts");
    const occApi = read("app/api/owner/occurrences/route.ts");
    const patchApi = read("app/api/owner/occurrences/[occurrenceId]/route.ts");
    const validation = read("lib/events/owner-occurrence-input.ts");
    const hub = read("lib/live/load-live-hub.ts");
    const scheduleRepo = read("lib/events/repository.ts");

    for (const source of [eventsApi, occApi, patchApi]) {
      assert.match(source, /requireOwnerUser/);
      assert.match(source, /isOwnerAuthed/);
    }

    assert.match(occApi, /export async function POST/);
    assert.match(patchApi, /action === "publish"/);
    assert.match(patchApi, /action === "unpublish"/);
    assert.match(patchApi, /action === "cancel"/);
    assert.match(validation, /scheduledStartAt is required when startMode is fixed/);
    assert.doesNotMatch(validation, /Nov(?:ember)?\s*3|fake speaker|demo venue/i);

    assert.match(hub, /getPublishedOccurrences/);
    assert.match(scheduleRepo, /visibility/);
    assert.match(scheduleRepo, /published/);
  });

  it("owner UI uses real APIs and truthful empty copy", () => {
    const ui = read("components/owner/EventManagementClient.tsx");
    assert.match(ui, /\/api\/owner\/events/);
    assert.match(ui, /\/api\/owner\/occurrences/);
    assert.match(ui, /\/api\/owner\/production-sources\/assign/);
    assert.match(ui, /No occurrences yet/);
    assert.match(ui, /No approved broadcast sources configured/);
    assert.doesNotMatch(ui, /mock schedule|demo occurrence|fake event/i);
  });

  it("archives and replays owner workflows remain wired", () => {
    assert.equal(fs.existsSync(path.join(root, "app/owner/archives/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/owner/replays/page.tsx")), true);
    assert.match(read("components/owner/ArchiveManagementClient.tsx"), /\/api\/owner\/archives/);
    assert.match(read("components/owner/ReplayManagementClient.tsx"), /\/api\/owner\/replays/);
  });
});
