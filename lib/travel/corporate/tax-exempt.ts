/**
 * Client-safe tax-exempt validation helpers (mime, EIN, upload body sanitize).
 *
 * DB lookups live in server-only modules:
 * - `lib/travel/corporate/tax-exempt-profile.ts` → getChurchTaxProfile / loadTaxProfileForChurch
 * - `lib/travel/corporate/tax-exempt-review.ts` → owner review mutators
 * Do not add getSupabaseAdmin() here — TaxExemptUploadClient imports this file.
 */

export const TAX_EXEMPT_CERTIFICATE_BUCKET = "tax-exempt-certificates";
export const TAX_EXEMPT_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

export const TAX_EXEMPT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type TaxExemptAllowedMimeType = (typeof TAX_EXEMPT_ALLOWED_MIME_TYPES)[number];

const EIN_DIGITS = /^\d{9}$/;
const EIN_HYPHEN = /^\d{2}-\d{7}$/;

export function isTaxExemptAllowedMimeType(
  value: string,
): value is TaxExemptAllowedMimeType {
  return (TAX_EXEMPT_ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function extensionForTaxExemptMime(mime: TaxExemptAllowedMimeType): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
  }
}

/** Normalize EIN to NN-NNNNNNN or null if invalid. */
export function normalizeEin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (EIN_HYPHEN.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!EIN_DIGITS.test(digits)) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function taxExemptCertificateObjectPath(input: {
  churchId: string;
  profileId: string;
  mimeType: TaxExemptAllowedMimeType;
}): string {
  const ext = extensionForTaxExemptMime(input.mimeType);
  return `${input.churchId}/${input.profileId}/certificate.${ext}`;
}

export type TaxExemptUploadRequestFields = {
  legalName: string;
  ein: string;
  mimeType: TaxExemptAllowedMimeType;
  fileSize: number | null;
};

export type TaxExemptUploadValidationError = {
  status: 400;
  error: string;
};

/**
 * Sanitize client upload-session body.
 * Requires legal_name, ein (NN-NNNNNNN), and mime_type in
 * {application/pdf, image/jpeg, image/png}.
 * Rejects client church_id, verification_status, and storage path spoofing.
 */
export function sanitizeTaxExemptUploadRequest(
  body: unknown,
): TaxExemptUploadRequestFields | TaxExemptUploadValidationError {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, error: "Request body must be a JSON object." };
  }

  const source = body as Record<string, unknown>;
  if (
    "church_id" in source ||
    "churchId" in source ||
    "verification_status" in source ||
    "verificationStatus" in source ||
    "certificate_object_path" in source ||
    "status" in source
  ) {
    return {
      status: 400,
      error: "Client-supplied church, status, or storage path fields are rejected.",
    };
  }

  const legalName = String(source.legal_name ?? source.legalName ?? "").trim();
  if (legalName.length < 2) {
    return { status: 400, error: "legal_name is required." };
  }

  const ein = normalizeEin(source.ein ?? source.EIN);
  if (!ein) {
    return { status: 400, error: "ein must be a valid EIN (NN-NNNNNNN)." };
  }

  const mimeTypeRaw = source.mime_type ?? source.mimeType;
  if (mimeTypeRaw == null || String(mimeTypeRaw).trim() === "") {
    return { status: 400, error: "mime_type is required." };
  }

  const mimeType = String(mimeTypeRaw).trim().toLowerCase();
  if (!isTaxExemptAllowedMimeType(mimeType)) {
    return {
      status: 400,
      error: "mime_type must be application/pdf, image/jpeg, or image/png.",
    };
  }

  let fileSize: number | null = null;
  if ("file_size" in source || "fileSize" in source) {
    const raw = Number(source.file_size ?? source.fileSize);
    if (!Number.isInteger(raw) || raw <= 0 || raw > TAX_EXEMPT_CERTIFICATE_MAX_BYTES) {
      return {
        status: 400,
        error: `file_size must be between 1 and ${TAX_EXEMPT_CERTIFICATE_MAX_BYTES} bytes.`,
      };
    }
    fileSize = raw;
  }

  return {
    legalName: legalName.slice(0, 200),
    ein,
    mimeType,
    fileSize,
  };
}

export function isTaxExemptUploadValidationError(
  value: TaxExemptUploadRequestFields | TaxExemptUploadValidationError,
): value is TaxExemptUploadValidationError {
  return "status" in value && value.status === 400;
}
