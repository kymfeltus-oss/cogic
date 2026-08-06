import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";

import {
  CREDENTIAL_CACHE_CONTROL,
  CREDENTIAL_REFERRER_POLICY,
  CREDENTIAL_ROBOTS_TAG,
  applyCredentialSecurityHeaders,
  credentialSecurityHeaderRecord,
} from "@/lib/credentials/security-headers";

describe("credential security headers", () => {
  it("sets required cache, referrer, and robots headers", () => {
    const response = applyCredentialSecurityHeaders(NextResponse.next());
    assert.equal(response.headers.get("Cache-Control"), CREDENTIAL_CACHE_CONTROL);
    assert.equal(response.headers.get("Referrer-Policy"), CREDENTIAL_REFERRER_POLICY);
    assert.equal(response.headers.get("X-Robots-Tag"), CREDENTIAL_ROBOTS_TAG);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  });

  it("exports a stable header record for config verification", () => {
    const record = credentialSecurityHeaderRecord();
    assert.match(record["Cache-Control"], /no-store/);
    assert.equal(record["Referrer-Policy"], "no-referrer");
    assert.match(record["X-Robots-Tag"], /noindex/);
  });
});
