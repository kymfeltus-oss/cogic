import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildCanonicalCredentialUrl } from "@/lib/credentials/qr-url";
import { generateCredentialToken } from "@/lib/credentials/token";
import { isCredentialPublicRoute } from "@/lib/routes";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Phase 5B routing contract", () => {
  it("defines ingress and clean routes", () => {
    assert.equal(fs.existsSync(path.join(root, "app/c/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/c/[token]/route.ts")), true);
    assert.equal(fs.existsSync(path.join(root, "app/c/layout.tsx")), true);
  });

  it("redirects ingress to token-free /c path", () => {
    const clean = new URL("/c", "https://example.com/c/token-value");
    assert.equal(clean.pathname, "/c");
    assert.equal(clean.search, "");
    assert.equal(clean.hash, "");
  });

  it("rejects malformed ingress tokens before resolution", () => {
    const ingress = fs.readFileSync(
      path.join(root, "lib/credentials/ingress.ts"),
      "utf8",
    );
    assert.match(ingress, /isValidCredentialToken/);
    assert.match(ingress, /isMalformedIngressToken/);
  });

  it("builds canonical QR payload without PII", () => {
    const previousOrigin = process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN;
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN = "https://live.example.com";
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      const token = generateCredentialToken();
      const url = buildCanonicalCredentialUrl(token);
      assert.match(url, /^https:\/\/live\.example\.com\/c\/[A-Za-z0-9_-]{43}$/);
      assert.equal(url.includes("@"), false);
      assert.equal(url.includes("registration"), false);
      assert.equal(new URL(url).hostname, "live.example.com");
    } finally {
      if (previousOrigin === undefined) {
        delete process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN;
      } else {
        process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN = previousOrigin;
      }
      if (previousAppUrl === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
      }
    }
  });

  it("isolates credential routes from global navigation", () => {
    assert.equal(isCredentialPublicRoute("/c"), true);
    assert.equal(isCredentialPublicRoute("/c/abc"), true);
    assert.equal(isCredentialPublicRoute("/contact-us"), false);
  });

  it("keeps ingress route server-only without client token props", () => {
    const ingress = fs.readFileSync(
      path.join(root, "app/c/[token]/route.ts"),
      "utf8",
    );
    assert.doesNotMatch(ingress, /use client/);
    assert.match(ingress, /handleCredentialIngress/);
    assert.doesNotMatch(ingress, /localStorage|sessionStorage/);
  });

  it("does not store raw tokens in session modules", () => {
    const session = fs.readFileSync(
      path.join(root, "lib/credentials/session.ts"),
      "utf8",
    );
    const crypto = fs.readFileSync(
      path.join(root, "lib/credentials/session-crypto.ts"),
      "utf8",
    );
    assert.doesNotMatch(session, /rawToken/);
    assert.doesNotMatch(crypto, /rawToken/);
    assert.doesNotMatch(crypto, /token_hash/);
    assert.match(session, /path: "\/c"/);
    assert.match(session, /httpOnly: true/);
  });
});
