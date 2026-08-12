import assert from "node:assert/strict";
import test from "node:test";
import { credentialPresentationCopy, normalizeCredentialPresentationState } from "../credential-presentation-state";

test("credential presentation exposes every required truthful state", () => {
  assert.deepEqual(credentialPresentationCopy("issued"), { label: "Issued", message: "Credential issued.", canPresent: true });
  assert.deepEqual(credentialPresentationCopy("active"), { label: "Active", message: "Credential active.", canPresent: true });
  assert.deepEqual(credentialPresentationCopy("revoked"), { label: "Revoked", message: "Credential revoked.", canPresent: false });
  assert.deepEqual(credentialPresentationCopy("not_issued"), { label: "Not yet issued", message: "Credential not yet issued.", canPresent: false });
  assert.deepEqual(credentialPresentationCopy("expired"), { label: "Unavailable", message: "Credential unavailable.", canPresent: false });
});

test("unknown credential states fail closed as unavailable", () => {
  assert.equal(normalizeCredentialPresentationState("rotated"), "unavailable");
  assert.equal(normalizeCredentialPresentationState("unexpected"), "unavailable");
});
