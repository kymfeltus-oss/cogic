import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { slugifyArchivePart } from "@/lib/archives/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("archive / attribution contracts", () => {
  it("slugifies archive parts safely", () => {
    assert.equal(slugifyArchivePart("118th Holy Convocation — 2026"), "118th-holy-convocation-2026");
    assert.equal(slugifyArchivePart("  Revival Fire  "), "revival-fire");
  });

  it("keeps giving source types allowlisted in attribution module", () => {
    const attribution = fs.readFileSync(
      path.join(root, "lib/giving/attribution.ts"),
      "utf8",
    );
    assert.match(attribution, /"live"/);
    assert.match(attribution, /"replay"/);
    assert.match(attribution, /"collection"/);
    assert.doesNotMatch(attribution, /paid_vod/);
  });
});
