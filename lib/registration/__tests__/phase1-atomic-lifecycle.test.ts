import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("registration Phase 1 atomic lifecycle contracts", () => {
  it("keeps drafts nullable while enforcing submitted data", () => {
    const sql = read("supabase/migrations/20260812010000_registration_draft_resume.sql");
    assert.match(sql, /country_code DROP NOT NULL/i);
    assert.match(sql, /status IN \('submitted', 'payment_pending', 'confirmed'\)/);
    assert.match(sql, /registration_product_id IS NULL/);
    assert.match(sql, /row_version integer NOT NULL DEFAULT 1/i);
  });

  it("locks groups and members and rejects version drift inside lifecycle RPCs", () => {
    const sql = read("supabase/migrations/20260812020000_registration_atomic_lifecycle.sql");
    for (const fn of [
      "save_registration_primary_draft",
      "submit_registration_group",
      "confirm_paid_registration_group",
      "cancel_registration_group",
      "begin_registration_checkout",
      "cancel_pending_registration_checkout",
    ]) assert.match(sql, new RegExp(`FUNCTION public\\.${fn}`, "i"));
    assert.match(sql, /FOR UPDATE/g);
    assert.match(sql, /_assert_registration_member_versions/);
    assert.match(sql, /ERRCODE = '(?:40001|serialization_failure)'/g);
    assert.match(sql, /member version snapshot is missing member/);
    assert.match(sql, /snapshot contains stale members/);
    assert.match(sql, /JOIN public\.registration_products/);
    assert.match(sql, /INSERT INTO public\.audit_logs/g);
    assert.doesNotMatch(sql, /\bp_amount_cents\b|\bp_status\b|\bp_total_cents\b/i);
  });

  it("defines an RLS-protected idempotent credential retry queue", () => {
    const sql = read("supabase/migrations/20260812030000_registration_credential_retry_queue.sql");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.registration_credential_jobs/);
    assert.match(sql, /WHERE status IN \('pending', 'processing', 'retry', 'failed'\)/);
    assert.match(sql, /enqueue_registration_credential_job/);
    assert.match(sql, /credential (?:jobs|retry) require(?:s)? confirmed registration/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  });

  it("declares refund ledger and allowlisted attendee correction RPC", () => {
    const sql = read("supabase/migrations/20260812040000_registration_admin_operations.sql");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.registration_refund_operations/);
    assert.match(sql, /operation_key/);
    assert.match(sql, /idempotency_key/);
    assert.match(sql, /requested_amount_cents/);
    assert.match(sql, /stripe_refund_id/);
    assert.match(sql, /operator_reason/);
    assert.match(sql, /FUNCTION public\.correct_registration_attendee/);
    assert.match(sql, /'firstName'/);
    assert.match(sql, /'lastName'/);
    assert.match(sql, /'email'/);
    assert.match(sql, /'phone'/);
    assert.match(sql, /'interpretationLanguage'/);
    assert.match(sql, /'juniorDob'/);
    assert.match(sql, /FOR UPDATE/);
    assert.match(sql, /rejects transactional\/authority field/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.correct_registration_attendee/);
    assert.doesNotMatch(sql, /\bp_amount_cents\b|\bp_status\b/);

    const claimSql = read("supabase/migrations/20260812050000_registration_refund_claim.sql");
    assert.match(claimSql, /claim_registration_refund_operation/);
    assert.match(claimSql, /complete_registration_refund_operation/);
    assert.match(claimSql, /v_payment\.amount_cents/);
  });

  it("routes repository lifecycle changes through RPCs without client authority fields", () => {
    const repository = read("lib/registration/slice2-repository.ts");
    const payments = read("lib/registration/payment-repository.ts");
    const jobs = read("lib/registration/credential-jobs.ts");
    assert.match(repository, /rpc\("save_registration_primary_draft"/);
    assert.match(repository, /"submit_registration_group"/);
    assert.match(repository, /rpc\("confirm_paid_registration_group"/);
    assert.match(repository, /rpc\("cancel_registration_group"/);
    assert.doesNotMatch(repository, /\bp_amount_cents\b|\bp_total_cents\b|\bp_status\b/);
    assert.match(payments, /rpc\("begin_registration_checkout"/);
    assert.match(payments, /rpc\("cancel_pending_registration_checkout"/);
    assert.doesNotMatch(payments, /p_amount_cents|amount_cents:\s*input/i);
    assert.match(jobs, /rpc\("enqueue_registration_credential_job"/);
  });

  it("derives Step 1 ownership only from the authenticated server session", () => {
    const route = read("app/api/registration/experience/route.ts");
    assert.match(route, /const user = await currentAttendee\(\)/);
    assert.match(route, /savePrimaryRegistrationDraft\(user\.id, draft,/);
    assert.match(route, /sanitizeRegistrationPrimaryDraftInput\(readPrimaryDraftSource\(body\)\)/);
    assert.doesNotMatch(route, /savePrimaryRegistrationDraft\(body\??\.?userId/);
    assert.doesNotMatch(route, /savePrimaryRegistrationDraft\([^,]+\.user_id/);
  });

  it("exposes atomic owner cancellation and trackable credential recovery hooks", () => {
    const owner = read("app/api/owner/registrations/route.ts");
    const singular = read("app/api/owner/registration/route.ts");
    assert.match(owner, /cancelRegistrationGroup/);
    assert.doesNotMatch(owner, /from\("registrations"\)\.update\(\{status:"canceled"/);
    assert.match(owner, /retry_credential/);
    assert.match(owner, /process_credential_queue/);
    assert.match(owner, /registration_credential_jobs/);
    assert.match(owner, /status:\s*202/);
    assert.match(singular, /owner\/registrations\/route/);
  });
});
