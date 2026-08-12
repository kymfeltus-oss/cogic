import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("tax-exempt confirm upload route", () => {
  it("advances pending_upload to pending_review only after storage list confirms file", () => {
    const route = read("app/api/travel/corporate/tax-exempt/confirm/route.ts");
    assert.match(route, /resolveServerOrgContext/);
    assert.match(route, /status: 403/);
    assert.match(route, /Pastor or Overseer/);
    assert.match(route, /pending_upload/);
    assert.match(route, /status: 409/);
    assert.match(route, /\.list\(/);
    assert.match(route, /tax-exempt-certificates|TAX_EXEMPT_CERTIFICATE_BUCKET/);
    assert.match(route, /status: 404/);
    assert.match(route, /pending_review/);
    assert.match(route, /status: 200/);
    assert.match(route, /getSupabaseAdmin/);
    assert.doesNotMatch(route, /USE_MOCK|placeholder|fake/i);
  });

  it("ships confirm route file", () => {
    assert.ok(
      fs.existsSync(
        path.join(root, "app/api/travel/corporate/tax-exempt/confirm/route.ts"),
      ),
    );
  });
});
