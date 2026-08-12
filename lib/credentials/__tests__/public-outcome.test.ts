import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  collapseToPublicView,
  resolvedPublicFieldAllowlist,
  shouldIssueCredentialSession,
  toSessionPayload,
} from "@/lib/credentials/public-outcome";
import type { SafeCredentialResolution } from "@/lib/credentials/types";

describe("public credential outcome collapsing", () => {
  const resolved: SafeCredentialResolution = {
    outcome: "resolved",
    status: "active",
    badgeCode: "CS26-A1B2C3D4",
    firstName: "Jordan",
    churchName: "Temple of Hope",
    jurisdiction: "Texas Southwest",
    programKey: "cogic-stream-2026",
  };

  it("issues session only for resolved usable credentials", () => {
    assert.equal(shouldIssueCredentialSession(resolved), true);
    assert.equal(
      shouldIssueCredentialSession({ ...resolved, outcome: "revoked" }),
      false,
    );
    assert.equal(
      shouldIssueCredentialSession({ ...resolved, status: undefined }),
      false,
    );
  });

  it("collapses invalid states into unavailable", () => {
    for (const outcome of ["invalid", "rotated", "revoked", "expired", "unavailable"] as const) {
      const view = collapseToPublicView({ ...resolved, outcome });
      assert.equal(view.kind, "unavailable");
    }
  });

  it("allowlists only safe public fields", () => {
    assert.deepEqual(resolvedPublicFieldAllowlist(), [
      "status",
      "badgeCode",
      "firstName",
      "churchName",
      "jurisdiction",
      "programKey",
    ]);
    const payload = toSessionPayload(
      resolved as SafeCredentialResolution & {
        outcome: "resolved";
        status: "issued" | "active";
      },
    );
    assert.deepEqual(Object.keys(payload).sort(), resolvedPublicFieldAllowlist().slice().sort());
  });
});
