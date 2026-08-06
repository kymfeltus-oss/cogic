import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactForLog, redactSecrets, safeErrorMessage } from "@/lib/security/redact";

describe("log redaction", () => {
  it("redacts Stripe secrets, bearer tokens, and webhook secrets", () => {
    const input =
      "Authorization: Bearer abc.def.ghi sk_live_51ExampleSecret whsec_exampleSecretValue";
    const output = redactSecrets(input);
    assert.equal(output.includes("sk_live_"), false);
    assert.equal(output.includes("whsec_"), false);
    assert.equal(output.includes("Bearer abc"), false);
    assert.match(output, /\[REDACTED\]/);
  });

  it("redacts credential URLs and raw /c tokens", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCDE_-";
    const input = `scan https://live.example.com/c/${token} failed`;
    const output = redactSecrets(input);
    assert.equal(output.includes(token), false);
    assert.equal(output.includes("/c/abcdefghijklmnopqrstuvwxyz"), false);
  });

  it("redacts sensitive object keys", () => {
    const output = redactForLog({
      authorization: "Bearer secret-token",
      rawToken: "abcdefghijklmnopqrstuvwxyz0123456789ABCDE_-",
      ok: true,
    }) as Record<string, unknown>;
    assert.equal(output.authorization, "[REDACTED]");
    assert.equal(output.rawToken, "[REDACTED]");
    assert.equal(output.ok, true);
  });

  it("safeErrorMessage never returns raw Stripe secrets", () => {
    const message = safeErrorMessage(new Error("bad key sk_test_abcdefghijklmnopqrstuv"));
    assert.equal(message.includes("sk_test_"), false);
  });
});
