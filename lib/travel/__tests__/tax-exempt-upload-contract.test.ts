import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  isTaxExemptUploadValidationError,
  normalizeEin,
  sanitizeTaxExemptUploadRequest,
  taxExemptCertificateObjectPath,
} from "@/lib/travel/corporate/tax-exempt";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("tax-exempt signed upload route", () => {
  it("normalizes EIN and builds church/profile certificate paths", () => {
    assert.equal(normalizeEin("12-3456789"), "12-3456789");
    assert.equal(normalizeEin("123456789"), "12-3456789");
    assert.equal(normalizeEin("bad"), null);

    assert.equal(
      taxExemptCertificateObjectPath({
        churchId: "11111111-1111-4111-8111-111111111111",
        profileId: "22222222-2222-4222-8222-222222222222",
        mimeType: "application/pdf",
      }),
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/certificate.pdf",
    );
  });

  it("rejects client church/status/path spoofing and requires legal fields", () => {
    const spoofed = sanitizeTaxExemptUploadRequest({
      legal_name: "First Church",
      ein: "12-3456789",
      mime_type: "application/pdf",
      church_id: "spoof",
    });
    assert.equal(isTaxExemptUploadValidationError(spoofed), true);

    const ok = sanitizeTaxExemptUploadRequest({
      legalName: "First Church",
      ein: "123456789",
      mimeType: "application/pdf",
      fileSize: 1024,
    });
    assert.equal(isTaxExemptUploadValidationError(ok), false);
    if (!isTaxExemptUploadValidationError(ok)) {
      assert.equal(ok.ein, "12-3456789");
      assert.equal(ok.mimeType, "application/pdf");
    }
  });

  it("keeps upload route fail-closed and leadership-gated", () => {
    const route = read("app/api/travel/corporate/tax-exempt/upload/route.ts");
    assert.match(route, /resolveServerOrgContext/);
    assert.match(route, /status: 403/);
    assert.doesNotMatch(route, /status: 401/);
    assert.match(route, /Pastor or Overseer/);
    assert.match(route, /verification_status === "verified"/);
    assert.match(route, /status: 409/);
    assert.match(route, /pending_upload/);
    assert.match(route, /createSignedUploadUrl/);
    assert.match(route, /TAX_EXEMPT_CERTIFICATE_BUCKET/);
    assert.match(route, /getSupabaseAdmin/);
    assert.match(route, /clearCertificateFields/);
    assert.doesNotMatch(route, /verification_status:\s*"verified"/);
    assert.match(
      read("lib/travel/corporate/tax-exempt.ts"),
      /tax-exempt-certificates/,
    );
  });

  it("ships upload helper + route files", () => {
    assert.ok(fs.existsSync(path.join(root, "lib/travel/corporate/tax-exempt.ts")));
    assert.ok(
      fs.existsSync(
        path.join(root, "app/api/travel/corporate/tax-exempt/upload/route.ts"),
      ),
    );
  });

  it("upload client serializes POST body keys from HTML name attributes", () => {
    const client = read("components/travel/TaxExemptUploadClient.tsx");
    assert.match(client, /new FormData\(event\.currentTarget\)/);
    assert.match(client, /name="legal_name"/);
    assert.match(client, /name="ein"/);
    assert.match(client, /name="certificate"/);
    assert.match(client, /legal_name: legalName/);
    assert.match(client, /mime_type: file\.type/);
    assert.match(client, /file_size: file\.size/);
  });
});
