import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  REGISTRATION_CORRECTION_ALLOWLIST,
  sanitizeRegistrationCorrectionInput,
} from "@/lib/registration/admin-correct-sanitize";
import {
  buildRegistrationOwnerPagination,
  decodeRegistrationOwnerCursor,
  encodeRegistrationOwnerCursor,
  parseRegistrationOwnerPageSize,
} from "@/lib/registration/owner-pagination";
import { retiredOwnerActionDisposition } from "@/lib/owner/retired-actions";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("registration Phase 3 admin console", () => {
  it("immutably retires owner verify/confirm bypasses with HTTP 410", () => {
    for (const domain of ["travel", "registration"] as const) {
      for (const action of ["verify", "confirm", "mark_verified"]) {
        const disposition = retiredOwnerActionDisposition(domain, action);
        assert.equal(disposition?.status, 410);
        assert.match(String(disposition?.code), /retired/);
      }
    }

    const travelRoute = read("app/api/owner/travel/route.ts");
    const registrationRoute = read("app/api/owner/registrations/route.ts");
    assert.match(travelRoute, /retiredOwnerActionDisposition\("travel", action\)/);
    assert.match(registrationRoute, /retiredOwnerActionDisposition\("registration", body\?\.action\)/);
  });

  it("serializes cancel versus payment confirmation and rejects membership drift", () => {
    const migration = read(
      "supabase/migrations/20260812020000_registration_atomic_lifecycle.sql",
    );
    const confirmStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.confirm_paid_registration_group");
    const cancelStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.cancel_registration_group");
    assert.ok(confirmStart >= 0 && cancelStart > confirmStart);
    const confirmSql = migration.slice(confirmStart, cancelStart);
    const cancelSql = migration.slice(cancelStart);

    for (const sql of [confirmSql, cancelSql]) {
      assert.match(sql, /registration_groups[\s\S]*FOR UPDATE/);
      assert.match(sql, /registrations[\s\S]*FOR UPDATE/);
      assert.match(sql, /_assert_registration_group_version/);
      assert.match(sql, /_assert_registration_member_versions/);
    }
    assert.match(migration, /member version snapshot is missing member/);
    assert.match(migration, /snapshot contains stale members/);
    assert.match(migration, /registration member version conflict/);
    assert.match(migration, /ERRCODE = '(?:40001|serialization_failure)'/);
  });
  it("encodes stable cursors and pages without a hard 250-row window", () => {
    const encoded = encodeRegistrationOwnerCursor({
      createdAt: "2026-08-11T12:00:00.000Z",
      id: "11111111-1111-1111-1111-111111111111",
    });
    assert.deepEqual(decodeRegistrationOwnerCursor(encoded), {
      createdAt: "2026-08-11T12:00:00.000Z",
      id: "11111111-1111-1111-1111-111111111111",
    });
    assert.equal(parseRegistrationOwnerPageSize("999"), 100);
    assert.equal(parseRegistrationOwnerPageSize("0"), 50);

    const page = buildRegistrationOwnerPagination({
      pageSize: 2,
      rows: [
        { created_at: "2026-08-11T03:00:00.000Z", id: "a" },
        { created_at: "2026-08-11T02:00:00.000Z", id: "b" },
        { created_at: "2026-08-11T01:00:00.000Z", id: "c" },
      ],
    });
    assert.equal(page.pageRows.length, 2);
    assert.equal(page.pagination.hasMore, true);
    assert.ok(page.pagination.nextCursor);
  });

  it("owner GET uses cursor pagination and isolates CSV export", () => {
    const route = read("app/api/owner/registrations/route.ts");
    assert.match(route, /pagination/);
    assert.match(route, /nextCursor/);
    assert.match(route, /hasMore/);
    assert.match(route, /pageSize/);
    assert.match(route, /decodeRegistrationOwnerCursor/);
    assert.match(route, /get\("format"\) === "csv"/);
    assert.match(route, /buildCsvExport/);
    assert.doesNotMatch(route, /\.limit\(250\)/);
    assert.match(route, /data:\s*pageRows/);
  });

  it("owner cancel requires groupId + reason and calls atomic RPC wrapper", () => {
    const route = read("app/api/owner/registrations/route.ts");
    assert.match(route, /action === "cancel_registration"/);
    assert.match(route, /groupId is required/);
    assert.match(route, /cancellation reason of at least 8 characters/i);
    assert.match(route, /cancelRegistrationGroup/);
    assert.match(route, /groupId:\s*group\.id/);
    assert.doesNotMatch(route, /mark paid|markPaid/i);
  });

  it("refund saga claims ledger amounts and rejects client amounts", () => {
    const route = read("app/api/owner/registrations/refund/route.ts");
    const service = read("lib/registration/admin-refund.ts");
    const migration = read(
      "supabase/migrations/20260812050000_registration_refund_claim.sql",
    );

    assert.match(route, /requireOwnerUser/);
    assert.match(route, /Client-supplied refund amounts are rejected/);
    assert.match(route, /executeRegistrationOwnerRefund/);
    assert.match(service, /claim_registration_refund_operation/);
    assert.match(service, /complete_registration_refund_operation/);
    assert.match(service, /stripe\.refunds\.create/);
    assert.match(service, /idempotencyKey/);
    assert.match(service, /amount:\s*amountCents/);
    assert.doesNotMatch(service, /body\.amount|input\.amountCents/);
    assert.match(migration, /v_payment\.amount_cents/);
    const groupMigration = read("supabase/migrations/20260812060000_registration_phase3_reconciliation.sql");
    assert.match(service, /paymentIntents\.retrieve/);
    assert.match(service, /paymentIntent\.status !== "succeeded"/);
    assert.match(service, /complete_registration_group_refund/);
    assert.match(groupMigration, /UPDATE public\.registration_groups SET status='refunded'/);
    assert.match(groupMigration, /UPDATE public\.registration_credentials SET status='revoked'/);
  });

  it("provides audited Stripe, webhook, and offline reconciliation paths", () => {
    const route = read("app/api/owner/registrations/route.ts");
    const service = read("lib/registration/admin-reconciliation.ts");
    const migration = read("supabase/migrations/20260812060000_registration_phase3_reconciliation.sql");
    assert.match(route, /action === "reconcile_payment"/);
    assert.match(route, /verify_stripe/);
    assert.match(route, /retry_webhook/);
    assert.match(route, /offline_check/);
    assert.match(service, /stripe\.checkout\.sessions\.retrieve/);
    assert.match(service, /fulfillRegistrationCheckoutFromWebhook/);
    assert.match(migration, /registration_reconciliations/);
    assert.match(migration, /record_offline_check_registration/);
    assert.match(migration, /FOR UPDATE/);
  });

  it("correction path allowlists fields and fails closed on authority keys", () => {
    const route = read("app/api/owner/registrations/correct/route.ts");
    const service = read("lib/registration/admin-correct.ts");

    assert.match(route, /correctRegistrationAttendee/);
    assert.match(service, /correct_registration_attendee/);
    assert.deepEqual([...REGISTRATION_CORRECTION_ALLOWLIST], [
      "firstName",
      "lastName",
      "email",
      "phone",
      "interpretationLanguage",
      "juniorDob",
    ]);

    const ok = sanitizeRegistrationCorrectionInput({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    assert.equal(ok.firstName, "Ada");

    assert.throws(
      () => sanitizeRegistrationCorrectionInput({ amountCents: 1, firstName: "Ada" }),
      /transactional\/authority field/i,
    );
    assert.throws(
      () => sanitizeRegistrationCorrectionInput({ status: "confirmed" }),
      /transactional\/authority field/i,
    );
    assert.throws(
      () =>
        sanitizeRegistrationCorrectionInput({
          firstName: "Ada",
          price_cents: 0,
          status: "confirmed",
        }),
      /transactional\/authority field/i,
    );
    assert.throws(
      () => sanitizeRegistrationCorrectionInput({ nickname: "x" }),
      /non-allowlisted field/i,
    );

    const migration = read(
      "supabase/migrations/20260812040000_registration_admin_operations.sql",
    );
    assert.match(migration, /v_previous_values := jsonb_build_object/);
    assert.match(migration, /'previous_values', v_previous_values/);
    assert.match(migration, /'new_values', jsonb_build_object/);
    assert.match(migration, /PERFORM public\._registration_audit\(/);
    const lifecycle = read(
      "supabase/migrations/20260812020000_registration_atomic_lifecycle.sql",
    );
    assert.match(lifecycle, /INSERT INTO public\.audit_logs/);
  });

  it("owner UI groups by registration group and exposes load-more + correction panels", () => {
    const ui = read("components/owner/RegistrationManagementClient.tsx");
    assert.match(ui, /Load more/);
    assert.match(ui, /nextCursor|pagination\.hasMore/);
    assert.match(ui, /registration_group_id/);
    assert.match(ui, /Audited profile correction/);
    assert.match(ui, /\/api\/owner\/registrations\/correct/);
    assert.match(ui, /\/api\/owner\/registrations\/refund/);
    assert.match(ui, /Cancel registration group/);
    assert.match(ui, /groupId/);
    assert.match(ui, /Execute Stripe refund/);
    assert.doesNotMatch(ui, /limit\(250\)|fake|demo/i);
  });
});
