import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  PublicOriginConfigurationError,
  buildCanonicalCredentialUrl,
  canonicalCredentialHost,
  resolvePublicWebOrigin,
} from "@/lib/credentials/qr-url";

const env = process.env as Record<string, string | undefined>;
const ORIGINAL_NODE_ENV = env.NODE_ENV;
const ORIGINAL_ORIGIN = env.COGIC_STREAM_PUBLIC_WEB_ORIGIN;
const ORIGINAL_APP_URL = env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_ORIGIN === undefined) delete env.COGIC_STREAM_PUBLIC_WEB_ORIGIN;
  else env.COGIC_STREAM_PUBLIC_WEB_ORIGIN = ORIGINAL_ORIGIN;
  if (ORIGINAL_APP_URL === undefined) delete env.NEXT_PUBLIC_APP_URL;
  else env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

describe("public origin / QR URL resolver", () => {
  it("prefers COGIC_STREAM_PUBLIC_WEB_ORIGIN over NEXT_PUBLIC_APP_URL", () => {
    env.NODE_ENV = "development";
    env.COGIC_STREAM_PUBLIC_WEB_ORIGIN = "https://preferred.example.com";
    env.NEXT_PUBLIC_APP_URL = "https://fallback.example.com";
    assert.equal(canonicalCredentialHost(), "preferred.example.com");
    assert.equal(
      buildCanonicalCredentialUrl("abcdefghijklmnopqrstuvwxyz0123456789ABCDE_-"),
      "https://preferred.example.com/c/abcdefghijklmnopqrstuvwxyz0123456789ABCDE_-",
    );
  });

  it("allows localhost only outside production", () => {
    env.NODE_ENV = "development";
    env.COGIC_STREAM_PUBLIC_WEB_ORIGIN = "http://localhost:3000";
    delete env.NEXT_PUBLIC_APP_URL;
    assert.equal(resolvePublicWebOrigin().host, "localhost:3000");
  });

  it("fails closed in production without HTTPS public origin", () => {
    env.NODE_ENV = "production";
    env.COGIC_STREAM_PUBLIC_WEB_ORIGIN = "http://localhost:3000";
    env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    assert.throws(() => resolvePublicWebOrigin(), PublicOriginConfigurationError);
  });

  it("does not fall back to a hard-coded legacy host", () => {
    env.NODE_ENV = "production";
    delete env.COGIC_STREAM_PUBLIC_WEB_ORIGIN;
    delete env.NEXT_PUBLIC_APP_URL;
    assert.throws(() => canonicalCredentialHost(), /not configured|HTTPS|localhost/i);
  });
});
