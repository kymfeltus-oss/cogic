"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  TAX_EXEMPT_ALLOWED_MIME_TYPES,
  TAX_EXEMPT_CERTIFICATE_MAX_BYTES,
} from "@/lib/travel/corporate/tax-exempt";
import { TravelBone, TravelFormSkeleton } from "@/components/travel/TravelLoadingSkeleton";

type ProfileStatus = {
  id: string;
  legalName: string;
  ein: string;
  verificationStatus: string;
  rejectionReason: string | null;
  uploadedAt: string | null;
  reviewedAt: string | null;
};

type StatusPayload = {
  churchId: string | null;
  churchName: string | null;
  canUpload: boolean;
  profile: ProfileStatus | null;
  error?: string;
};

const ACCEPT = TAX_EXEMPT_ALLOWED_MIME_TYPES.join(",");

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "pending_upload":
      return "Awaiting certificate upload";
    case "pending_review":
      return "Pending owner review";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected — re-upload required";
    case "expired":
      return "Expired";
    default:
      return "No profile on file";
  }
}

/**
 * Pastor/Overseer tax-exempt certificate upload.
 * Flow: status GET → signed upload POST → binary PUT → confirm POST.
 * Optional churchId/churchName props are display-only — church identity for
 * upload/confirm is always resolved server-side from session org context.
 */
export type TaxExemptUploadClientProps = {
  churchId?: string | null;
  churchName?: string | null;
};

export function TaxExemptUploadClient({
  churchId: churchIdProp = null,
  churchName: churchNameProp = null,
}: TaxExemptUploadClientProps = {}) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payload, setPayload] = useState<StatusPayload | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/travel/corporate/tax-exempt", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as StatusPayload & {
        error?: string;
      };
      if (res.status === 403) {
        setPayload(null);
        setError(null);
        return;
      }
      if (!res.ok) {
        throw new Error(json.error || "Unable to load tax-exempt status.");
      }
      setPayload({
        churchId: json.churchId ?? null,
        churchName: json.churchName ?? null,
        canUpload: Boolean(json.canUpload),
        profile: json.profile ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tax-exempt status.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const legalName = String(form.get("legal_name") ?? "").trim();
    const ein = String(form.get("ein") ?? "").trim();
    const fileEntry = form.get("certificate");
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

    if (!legalName || legalName.length < 2) {
      setError("Legal name is required.");
      return;
    }
    if (!file) {
      setError("Choose a PDF, JPEG, or PNG certificate file.");
      return;
    }
    if (file.size > TAX_EXEMPT_CERTIFICATE_MAX_BYTES) {
      setError("Certificate must be 10 MB or smaller.");
      return;
    }
    if (
      !(TAX_EXEMPT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)
    ) {
      setError("Certificate must be application/pdf, image/jpeg, or image/png.");
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);

    try {
      const sessionRes = await fetch("/api/travel/corporate/tax-exempt/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: legalName,
          ein,
          mime_type: file.type,
          file_size: file.size,
        }),
      });
      const session = (await sessionRes.json().catch(() => ({}))) as {
        signedUrl?: string;
        error?: string;
      };
      if (!sessionRes.ok || !session.signedUrl) {
        throw new Error(session.error || "Unable to start secure upload.");
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", session.signedUrl as string);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Certificate upload failed (${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error("Certificate upload failed."));
        xhr.send(file);
      });

      const confirmRes = await fetch("/api/travel/corporate/tax-exempt/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const confirmJson = (await confirmRes.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!confirmRes.ok) {
        throw new Error(confirmJson.error || "Unable to confirm certificate upload.");
      }

      event.currentTarget.reset();
      setNotice("Certificate uploaded. Your profile is pending owner review.");
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <section className="grid gap-3">
        <TravelBone className="h-6 w-48" />
        <TravelFormSkeleton />
      </section>
    );
  }

  if (!payload) {
    return null;
  }

  const status = payload.profile?.verificationStatus ?? null;
  const showUpload = payload.canUpload;
  const displayChurchName =
    churchNameProp?.trim() ||
    payload.churchName?.trim() ||
    "your church";

  return (
    <section className="grid gap-4 rounded-xl border border-white/15 bg-black/30 p-6">
      <div>
        <h2 className="text-lg font-bold text-white">Church tax-exempt profile</h2>
        <p className="mt-1 text-xs text-white/55">
          Upload your 501(c)(3) certificate for {displayChurchName}. Files go
          directly to a private bucket via a short-lived signed URL.
        </p>
        {churchIdProp ? (
          <p className="mt-1 text-[0.65rem] uppercase tracking-[0.14em] text-white/35">
            Org context linked
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/85">
        <p className="font-medium text-white">{statusLabel(status)}</p>
        {payload.profile ? (
          <p className="mt-1 text-xs text-white/55">
            {payload.profile.legalName} · EIN {payload.profile.ein}
            {payload.profile.rejectionReason
              ? ` · ${payload.profile.rejectionReason}`
              : ""}
          </p>
        ) : (
          <p className="mt-1 text-xs text-white/55">No certificate has been submitted yet.</p>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-xs text-red-100">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-xs text-emerald-100">
          {notice}
        </p>
      ) : null}

      {status === "pending_review" ? (
        <p className="text-sm text-white/65">
          Your certificate is queued for owner verification. Tax-exempt checkout applies only after
          verification.
        </p>
      ) : null}

      {status === "verified" ? (
        <p className="text-sm text-white/65">
          This church is verified for tax-exempt travel checkout. Contact an application owner to
          revise the profile.
        </p>
      ) : null}

      {showUpload ? (
        uploading ? (
          <TravelFormSkeleton />
        ) : (
          <form
            key={payload.profile?.id ?? payload.churchId ?? "new"}
            onSubmit={(event) => void handleUpload(event)}
            className="grid gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-white/80">
                Legal name (as on certificate)
                <input
                  required
                  minLength={2}
                  name="legal_name"
                  defaultValue={payload.profile?.legalName ?? ""}
                  className="min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-white/80">
                EIN (NN-NNNNNNN)
                <input
                  required
                  name="ein"
                  defaultValue={payload.profile?.ein ?? ""}
                  placeholder="12-3456789"
                  className="min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
                />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-medium text-white/80">
              Certificate file (PDF, JPEG, or PNG · max 10 MB)
              <input
                required
                type="file"
                name="certificate"
                accept={ACCEPT}
                className="min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-white px-5 text-xs font-semibold text-black"
              >
                Upload certificate
              </button>
            </div>
          </form>
        )
      ) : null}
    </section>
  );
}

export default TaxExemptUploadClient;
