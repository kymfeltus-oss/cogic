import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("Phase 2 church tax-exempt profile schema", () => {
  it("defines private tax-exempt-certificates bucket and church_tax_profiles", () => {
    const migration = read(
      "supabase/migrations/20260811000400_church_tax_exempt_profiles.sql",
    );

    assert.match(migration, /church_tax_profiles/);
    assert.match(migration, /verification_status/);
    assert.match(migration, /pending_upload/);
    assert.match(migration, /pending_review/);
    assert.match(migration, /'verified'/);
    assert.match(migration, /ein ~ '/);
    assert.match(migration, /tax-exempt-certificates/);
    assert.match(migration, /INSERT INTO storage\.buckets/);
    assert.match(migration, /'tax-exempt-certificates',\s*'tax-exempt-certificates',\s*false,/);
    assert.match(migration, /public = EXCLUDED\.public/);
    assert.match(migration, /application\/pdf/);
    assert.match(migration, /tax_profile_id/);
    assert.match(migration, /service_role/);
    assert.doesNotMatch(migration, /verification_status.*DEFAULT\s+'verified'/i);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  });

  it("keeps certificate objects non-public and write-gated to service_role", () => {
    const migration = read(
      "supabase/migrations/20260811000400_church_tax_exempt_profiles.sql",
    );
    assert.match(migration, /tax_exempt_certificates_service_all/);
    assert.match(migration, /tax_exempt_certificates_select_leader_or_owner/);
    assert.doesNotMatch(migration, /FOR INSERT\s+TO authenticated/);
    assert.doesNotMatch(migration, /TO anon/);
  });
});
