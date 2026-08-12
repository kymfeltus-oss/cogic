import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import {
  formatCentsAsDollars,
  guestDisplayName,
  itineraryDescriptors,
  loadTravelReceiptBundle,
  type TravelReceiptBundle,
} from "@/lib/travel/checkout/receipt-data";
import { buildTravelReceiptPdf } from "@/lib/travel/checkout/receipt-pdf";

export const dynamic = "force-dynamic";

function wantsJson(request: NextRequest): boolean {
  const format = String(request.nextUrl.searchParams.get("format") || "")
    .trim()
    .toLowerCase();
  if (format === "json" || format === "application/json") return true;
  const attemptId = String(
    request.nextUrl.searchParams.get("attemptId") ||
      request.nextUrl.searchParams.get("attempt_id") ||
      "",
  ).trim();
  // Confirmation page metadata loads via attemptId / explicit JSON.
  // Bare transaction_id defaults to the PDF download stream.
  if (attemptId && format !== "pdf" && format !== "application/pdf") {
    const accept = String(request.headers.get("accept") || "").toLowerCase();
    if (!accept.includes("application/pdf")) return true;
  }
  return false;
}

function receiptFilename(confirmation: string | null | undefined, transactionId: string) {
  const raw = String(confirmation || "").trim();
  const safe = raw.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 64);
  if (safe) return `COGIC_Convocation_Receipt_${safe}.pdf`;
  return `COGIC_Convocation_Receipt_${transactionId.slice(0, 8)}.pdf`;
}

/**
 * Production PDF buffer for an owned travel booking transaction.
 * Uses pdf-lib + QR/barcode rendering against live ledger rows (never empty stubs).
 */
async function generateServerSidePdfBuffer(
  bundle: TravelReceiptBundle,
  options: { buyerEmail: string },
): Promise<Buffer> {
  const pdfBytes = await buildTravelReceiptPdf(bundle, {
    buyerEmail: options.buyerEmail,
    formatCurrency: (cents) => formatCentsAsDollars(cents, "USD"),
  });
  return Buffer.from(pdfBytes);
}

export async function GET(request: NextRequest) {
  const auth = await resolveAuthenticatedBuyer(request);
  const transactionId = String(
    request.nextUrl.searchParams.get("transaction_id") ||
      request.nextUrl.searchParams.get("transactionId") ||
      "",
  ).trim();
  const attemptId = String(
    request.nextUrl.searchParams.get("attemptId") ||
      request.nextUrl.searchParams.get("attempt_id") ||
      "",
  ).trim();

  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized asset access" },
      { status: 401 },
    );
  }

  if (!transactionId && !attemptId) {
    return NextResponse.json(
      { error: "Unauthorized asset access" },
      { status: 401 },
    );
  }

  const asJson = wantsJson(request);
  if (!asJson && !transactionId) {
    return NextResponse.json(
      { error: "transaction_id is required for PDF receipt download." },
      { status: 400 },
    );
  }

  try {
    // Law 9: persistent rows scoped to the verified session user.
    const bundle = await loadTravelReceiptBundle({ transactionId, attemptId });
    if (!bundle) {
      return NextResponse.json(
        { error: "Transaction record not found" },
        { status: 404 },
      );
    }

    const ownerId = bundle.transaction?.user_id || bundle.attempt?.user_id || null;
    if (!ownerId || ownerId !== auth.buyer.userId) {
      return NextResponse.json(
        { error: "Transaction record not found" },
        { status: 404 },
      );
    }

    if (
      bundle.transaction &&
      bundle.attempt?.user_id &&
      bundle.attempt.user_id !== auth.buyer.userId
    ) {
      return NextResponse.json(
        { error: "Transaction record not found" },
        { status: 404 },
      );
    }

    const txn = bundle.transaction;
    const attempt = bundle.attempt;
    const offerSnapshot =
      (attempt?.offer_snapshot && typeof attempt.offer_snapshot === "object"
        ? attempt.offer_snapshot
        : null) ||
      (txn?.offer_snapshot && typeof txn.offer_snapshot === "object"
        ? txn.offer_snapshot
        : {}) ||
      {};

    if (!asJson) {
      if (!txn || txn.user_id !== auth.buyer.userId) {
        return NextResponse.json(
          { error: "Transaction record not found" },
          { status: 404 },
        );
      }

      const pdfBuffer = await generateServerSidePdfBuffer(
        { transaction: txn, attempt },
        { buyerEmail: auth.buyer.email },
      );
      const confirmation =
        txn.supplier_confirmation_number ||
        attempt?.supplier_confirmation_number ||
        attempt?.confirmation_number ||
        null;
      const filename = receiptFilename(confirmation, txn.id);

      return auth.withSessionCookies(
        new NextResponse(new Uint8Array(pdfBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(pdfBuffer.length),
            "Cache-Control": "private, no-store",
          },
        }),
      );
    }

    const confirmationNumber =
      txn?.supplier_confirmation_number ||
      attempt?.supplier_confirmation_number ||
      attempt?.confirmation_number ||
      null;

    return auth.withSessionCookies(
      NextResponse.json(
        {
          transactionId: txn?.id || null,
          attemptId: attempt?.id || txn?.marketplace_attempt_id || null,
          status: txn?.status || attempt?.status,
          kind: txn?.kind || attempt?.kind,
          provider: txn?.provider_key || attempt?.provider_key,
          confirmationNumber,
          supplierConfirmationNumber: confirmationNumber,
          totalAmountCents:
            txn?.total_amount_cents ?? attempt?.total_amount_cents ?? null,
          taxAmountCents: txn?.tax_amount_cents ?? attempt?.tax_amount_cents ?? null,
          currency: txn?.currency || attempt?.currency || "USD",
          destinationLabel:
            txn?.destination_label ?? attempt?.destination_label ?? null,
          originLabel: txn?.origin_label ?? attempt?.origin_label ?? null,
          startAt: txn?.start_at ?? attempt?.start_at ?? null,
          endAt: txn?.end_at ?? attempt?.end_at ?? null,
          offer: offerSnapshot,
          itinerary: itineraryDescriptors({
            kind: String(txn?.kind || attempt?.kind || ""),
            originLabel: txn?.origin_label ?? attempt?.origin_label ?? null,
            destinationLabel:
              txn?.destination_label ?? attempt?.destination_label ?? null,
            startAt: txn?.start_at ?? attempt?.start_at ?? null,
            endAt: txn?.end_at ?? attempt?.end_at ?? null,
            offerSnapshot,
          }),
          guestName: guestDisplayName(offerSnapshot, auth.buyer.email),
          confirmedAt: txn?.confirmed_at || attempt?.confirmed_at || null,
          failureReason: txn?.failure_reason || attempt?.failure_reason || null,
          paymentIntentId:
            txn?.payment_intent_id || attempt?.payment_intent_id || null,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      ),
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "File compilation failure",
      },
      { status: 500 },
    );
  }
}
