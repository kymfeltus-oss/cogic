import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/20260803010000_registration_credentials.sql",
);

describe("registration credentials migration contract (Phase 5A)", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("targets approved project and credential tables only", () => {
    assert.match(sql, /wjlaaluonxiaxmytiqwi/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.registration_credentials/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.credential_scan_events/);
    assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS public\.registrations\b/);
    assert.doesNotMatch(sql, /\/c\/\[token\]/);
    assert.doesNotMatch(sql, /qrcode|react-qr-code|zxing/i);
  });

  it("does not create a raw token column", () => {
    assert.doesNotMatch(sql, /\braw_token\b/);
    assert.doesNotMatch(sql, /\btoken_plaintext\b/);
    assert.doesNotMatch(sql, /\bplaintext_token\b/);
    assert.match(sql, /token_hash\s+bytea\s+NOT NULL/);
    assert.match(sql, /octet_length\(token_hash\) = 32/);
  });

  it("encodes credential status checks and terminal protection", () => {
    for (const status of ["issued", "active", "rotated", "revoked", "expired"]) {
      assert.match(sql, new RegExp(`'${status}'`));
    }
    assert.match(sql, /registration_credentials_status_check/);
    assert.match(sql, /terminal registration credential status cannot change/);
    assert.match(sql, /validate_registration_credential_status_transition/);
  });

  it("encodes one usable credential and version uniqueness", () => {
    assert.match(sql, /registration_credentials_one_usable_uidx/);
    assert.match(sql, /status IN \('issued', 'active'\)/);
    assert.match(sql, /registration_credentials_registration_version_uidx/);
    assert.match(sql, /UNIQUE \(registration_id, credential_version\)/);
    assert.match(sql, /registration_credentials_token_hash_uidx/);
  });

  it("encodes rotation and revocation field requirements", () => {
    assert.match(sql, /registration_credentials_rotated_requires_fields/);
    assert.match(sql, /replaced_by_credential_id IS NOT NULL/);
    assert.match(sql, /registration_credentials_revoked_requires_timestamp/);
    assert.match(sql, /revoked_at IS NOT NULL/);
    assert.match(sql, /registration_credentials_expires_after_issued/);
    assert.match(sql, /credential_version > 0/);
  });

  it("encodes confirmed-only issuance", () => {
    assert.match(sql, /confirmed registrations/);
    assert.match(sql, /v_registration\.status <> 'confirmed'/);
    assert.match(sql, /issue_registration_credential/);
  });

  it("encodes scan outcome and channel checks", () => {
    for (const outcome of [
      "resolved",
      "invalid",
      "rotated",
      "revoked",
      "expired",
      "rate_limited",
      "validated",
      "picked_up",
      "checked_in",
    ]) {
      assert.match(sql, new RegExp(`'${outcome}'`));
    }
    for (const channel of ["mobile_web", "badge_pickup", "admin_scanner"]) {
      assert.match(sql, new RegExp(`'${channel}'`));
    }
    assert.match(sql, /credential_scan_events is append-only/);
  });

  it("enables forced RLS and revokes anon/authenticated table access", () => {
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /FORCE ROW LEVEL SECURITY/);
    assert.match(
      sql,
      /REVOKE ALL ON public\.registration_credentials FROM PUBLIC, anon, authenticated/,
    );
    assert.match(
      sql,
      /REVOKE ALL ON public\.credential_scan_events FROM PUBLIC, anon, authenticated/,
    );
    assert.match(sql, /GRANT ALL ON public\.registration_credentials TO service_role/);
    assert.doesNotMatch(sql, /GRANT SELECT ON public\.registration_credentials TO authenticated/);
    assert.doesNotMatch(sql, /GRANT .* ON public\.registration_credentials TO anon/);
  });

  it("pins SECURITY DEFINER search_path and restricts RPC execute", () => {
    for (const fn of [
      "issue_registration_credential",
      "activate_registration_credential",
      "rotate_registration_credential",
      "revoke_registration_credential",
      "resolve_registration_credential",
    ]) {
      assert.match(sql, new RegExp(fn));
      assert.match(
        sql,
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*?FROM anon, authenticated`,
        ),
      );
      assert.match(
        sql,
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role`,
        ),
      );
    }
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /SET search_path = public/);
  });

  it("writes credential audit actions without raw token fields", () => {
    for (const action of [
      "credential.issued",
      "credential.activated",
      "credential.rotated",
      "credential.revoked",
    ]) {
      assert.match(sql, new RegExp(`'${action}'`));
    }
    assert.doesNotMatch(sql, /raw_token/);
    // Audit metadata objects must not embed the hash hex parameter.
    assert.doesNotMatch(
      sql,
      /INSERT INTO public\.audit_logs[\s\S]{0,400}p_token_hash_hex/,
    );
  });
});
