import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  isAdminPrepAccessOverrideEmail,
  isApplicationOwnerEmail,
} from "@/lib/access/admin-prep-override";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("resolveServerOrgContext contract", () => {
  it("evaluates platform owner from ADMIN_EMAILS helper", () => {
    const previous = process.env.ADMIN_EMAILS;
    try {
      process.env.ADMIN_EMAILS = "Owner@Example.com, ops@cogic.org";
      assert.equal(isApplicationOwnerEmail("owner@example.com"), true);
      assert.equal(isApplicationOwnerEmail("ops@cogic.org"), true);
      assert.equal(isApplicationOwnerEmail("random@example.com"), false);
      assert.equal(isAdminPrepAccessOverrideEmail("owner@example.com"), true);
    } finally {
      if (previous === undefined) {
        delete process.env.ADMIN_EMAILS;
      } else {
        process.env.ADMIN_EMAILS = previous;
      }
    }
  });

  it("keeps session-org context server-authoritative", () => {
    const source = read("lib/org/session-org-context.ts");
    assert.match(source, /getUserFromSession\(\)/);
    assert.match(source, /isApplicationOwnerEmail/);
    assert.match(source, /ADMIN_EMAILS/);
    assert.doesNotMatch(source, /getUserFromSession\(req\)/);
    assert.doesNotMatch(source, /body\.churchId|body\.role|searchParams\.get\(["']church/);
    assert.match(source, /church_memberships/);
    assert.match(read("app/api/org/me/route.ts"), /Authentication required/);
  });
});
