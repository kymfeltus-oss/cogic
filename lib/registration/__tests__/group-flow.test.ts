import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getGroupTotalCents,
  isJuniorRegistrationProduct,
  type RegistrationGroup,
} from "@/lib/registration/group-experience";

function group(status: string, primaryAmount: number): RegistrationGroup {
  return {
    id: "group-1",
    status,
    registrations: [
      {
        id: "primary",
        is_primary_registrant: true,
        relationship_to_primary: null,
        guardian_registration_id: null,
        registration_product_id: "general",
        salutation: null,
        first_name: "Jordan",
        last_name: "Smith",
        suffix: null,
        email: "jordan@example.com",
        mobile_phone: "5555555555",
        assistant_email: null,
        street_address: "1 Main Street",
        address_line_2: null,
        city: "Memphis",
        state: "TN",
        postal_code: "38103",
        country_code: "US",
        gender: null,
        requires_interpretation: false,
        preferred_language: null,
        church_name: "Example COGIC",
        pastor_name: "Pastor Smith",
        jurisdiction: "Tennessee",
        date_of_birth: null,
        amount_cents: primaryAmount,
        currency: "usd",
        status,
        confirmation_reference: null,
      },
      {
        id: "junior",
        is_primary_registrant: false,
        relationship_to_primary: "child",
        guardian_registration_id: "primary",
        registration_product_id: "junior",
        salutation: null,
        first_name: "Avery",
        last_name: "Smith",
        suffix: null,
        email: null,
        mobile_phone: null,
        assistant_email: null,
        street_address: "1 Main Street",
        address_line_2: null,
        city: "Memphis",
        state: "TN",
        postal_code: "38103",
        country_code: "US",
        gender: null,
        requires_interpretation: false,
        preferred_language: null,
        church_name: "Example COGIC",
        pastor_name: "Pastor Smith",
        jurisdiction: "Tennessee",
        date_of_birth: "2014-11-03",
        amount_cents: 3500,
        currency: "usd",
        status,
        confirmation_reference: null,
      },
    ],
  };
}

test("draft group total sums every attendee", () => {
  assert.equal(getGroupTotalCents(group("draft", 12500)), 16000);
});

test("submitted group total does not double-count the stored primary total", () => {
  assert.equal(getGroupTotalCents(group("submitted", 16000)), 16000);
});

test("junior product is recognized by its controlled key", () => {
  assert.equal(isJuniorRegistrationProduct("JUNIOR_REGISTRATION_GUEST_2026"), true);
  assert.equal(isJuniorRegistrationProduct("GENERAL_REGISTRATION_2026"), false);
});

test("group-member database validation retains primary contact requirements", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20260810180000_registration_group_submission_validation.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /NEW\.is_primary_registrant OR NEW\.registration_group_id IS NULL/);
  assert.match(sql, /NEW\.email IS NULL/);
  assert.match(sql, /NEW\.mobile_phone IS NULL/);
  assert.match(sql, /NEW\.street_address IS NULL/);
});
