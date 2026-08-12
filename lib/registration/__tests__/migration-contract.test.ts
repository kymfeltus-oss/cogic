import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/20260801123000_registrations_and_registration_payments.sql",
);

describe("registrations migration contract (Gate A)", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("targets approved project and tables only", () => {
    assert.match(sql, /wjlaaluonxiaxmytiqwi/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.registrations/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.registration_payments/);
    assert.match(sql, /cogic-stream-2026/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.orders/);
    assert.doesNotMatch(sql, /ALTER TABLE public\.donations/);
    assert.doesNotMatch(sql, /app\/api\/webhooks\/stripe/);
  });

  it("encodes registration status and amount constraints", () => {
    for (const status of [
      "draft",
      "submitted",
      "payment_pending",
      "confirmed",
      "canceled",
      "refunded",
    ]) {
      assert.match(sql, new RegExp(`'${status}'`));
    }
    assert.match(sql, /registrations_status_check/);
    assert.match(sql, /registrations_amount_cents_non_negative/);
  });

  it("encodes submission field validation and lifecycle triggers", () => {
    assert.match(sql, /validate_registration_submission_fields/);
    assert.match(sql, /validate_registration_status_transition/);
    assert.match(sql, /normalize_registration_row/);
    assert.match(sql, /invalid registration status transition/);
    assert.match(sql, /may only be inserted with status draft/);
    assert.match(sql, /confirmed[\s\S]*refunded/);
  });

  it("encodes partial unique indexes for active duplicates", () => {
    assert.match(sql, /registrations_active_user_uidx/);
    assert.match(sql, /registrations_active_email_uidx/);
    assert.match(sql, /program_key, user_id/);
    assert.match(sql, /lower\(email\)/);
    assert.match(
      sql,
      /status IN \('draft', 'submitted', 'payment_pending', 'confirmed'\)/,
    );
  });

  it("encodes registration_payments constraints", () => {
    assert.match(sql, /registration_payments_status_check/);
    assert.match(sql, /registration_payments_checkout_type_check/);
    assert.match(sql, /checkout_type = 'registration'/);
    assert.match(sql, /amount_cents >= 0/);
    assert.match(sql, /ON DELETE RESTRICT/);
    assert.match(sql, /UNIQUE \(stripe_session_id\)/);
  });

  it("reuses set_row_updated_at and enables owner-only SELECT RLS", () => {
    assert.match(sql, /set_row_updated_at/);
    assert.match(sql, /registrations_set_updated_at/);
    assert.match(sql, /registration_payments_set_updated_at/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /registrations_select_own/);
    assert.match(sql, /registration_payments_select_own/);
    assert.match(sql, /user_id = auth\.uid\(\)/);
    assert.doesNotMatch(sql, /FOR INSERT\s+TO authenticated/);
    assert.doesNotMatch(sql, /FOR UPDATE\s+TO authenticated/);
    assert.doesNotMatch(sql, /FOR INSERT\s+TO anon/);
  });

  it("creates service_role-only fulfillment RPC with audit on success", () => {
    assert.match(sql, /fulfill_registration_checkout/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.fulfill_registration_checkout/);
    assert.match(sql, /TO service_role/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.fulfill_registration_checkout/);
    assert.match(sql, /FROM anon, authenticated/);
    assert.match(sql, /registration\.confirmed/);
    assert.match(sql, /INSERT INTO public\.audit_logs/);
    assert.match(sql, /idempotent/);
    assert.match(sql, /payment_pending/);
  });
});
