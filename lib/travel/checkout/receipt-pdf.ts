import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import {
  formatCentsAsDollars,
  guestDisplayName,
  itineraryDescriptors,
  type TravelReceiptBundle,
} from "@/lib/travel/checkout/receipt-data";

const BRAND = "COGIC Holy Convocation Travel Hub Receipt";
const INK = rgb(0.07, 0.1, 0.16);
const MUTED = rgb(0.35, 0.4, 0.48);
const RULE = rgb(0.82, 0.85, 0.9);
const ACCENT = rgb(0.55, 0.09, 0.09);
const PASS_BG = rgb(0.97, 0.96, 0.94);
const WHITE = rgb(1, 1, 1);
const BAR = rgb(0.07, 0.07, 0.08);

/** Minimal Code 39 patterns for A–Z, 0–9, and a few symbols. */
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "*": "nwnnwnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
};

function clip(value: string, max: number) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function moneyValue(
  cents: number | null | undefined,
  currency: string,
  formatter?: (cents: number) => string,
) {
  if (cents == null || !Number.isFinite(cents)) return "—";
  if (formatter) return formatter(Math.round(cents));
  return formatCentsAsDollars(cents, currency);
}

function drawCode39Barcode(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  height: number,
) {
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9\-. $/+%]/g, "")
    .slice(0, 28);
  if (!cleaned) return;

  const payload = `*${cleaned}*`;
  const narrow = 1.1;
  const wide = narrow * 2.4;
  const gap = narrow;
  let cursor = x;

  for (const char of payload) {
    const pattern = CODE39[char];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i += 1) {
      const isBar = i % 2 === 0;
      const width = pattern[i] === "w" ? wide : narrow;
      if (isBar) {
        page.drawRectangle({
          x: cursor,
          y,
          width,
          height,
          color: BAR,
        });
      }
      cursor += width;
      if (cursor - x > maxWidth) return;
    }
    cursor += gap;
    if (cursor - x > maxWidth) return;
  }
}

function numberFromSnapshot(
  snapshot: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const raw = snapshot[key];
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

export async function buildTravelReceiptPdf(
  bundle: TravelReceiptBundle,
  options?: {
    buyerEmail?: string | null;
    formatCurrency?: (cents: number) => string;
  },
): Promise<Uint8Array> {
  const txn = bundle.transaction;
  if (!txn) {
    throw new Error("A travel booking transaction is required to generate a PDF receipt.");
  }
  const attempt = bundle.attempt;
  const offerSnapshot =
    (attempt?.offer_snapshot && typeof attempt.offer_snapshot === "object"
      ? attempt.offer_snapshot
      : null) ||
    (txn.offer_snapshot && typeof txn.offer_snapshot === "object"
      ? txn.offer_snapshot
      : {}) ||
    {};

  const confirmation =
    String(
      txn.supplier_confirmation_number ||
        attempt?.supplier_confirmation_number ||
        attempt?.confirmation_number ||
        "",
    ).trim() || null;

  const totalCents =
    txn.total_amount_cents ?? attempt?.total_amount_cents ?? null;
  const taxCents = txn.tax_amount_cents ?? attempt?.tax_amount_cents ?? 0;
  const currency = txn.currency || attempt?.currency || "USD";
  const processingFeeCents =
    numberFromSnapshot(offerSnapshot, ["serviceFeeCents", "processingFeeCents"]) ?? 0;
  const baseFareCents =
    numberFromSnapshot(offerSnapshot, ["fareCents", "totalFareCents", "totalRateCents"]) ??
    (totalCents != null && Number.isFinite(totalCents)
      ? Math.max(
          0,
          Math.round(totalCents) -
            Math.round(Number(taxCents) || 0) -
            Math.round(processingFeeCents),
        )
      : null);

  const guestName = guestDisplayName(offerSnapshot, options?.buyerEmail);
  const accountRef = String(options?.buyerEmail || txn.user_id || "").trim();
  const descriptors = itineraryDescriptors({
    kind: txn.kind || attempt?.kind || "",
    originLabel: txn.origin_label ?? attempt?.origin_label ?? null,
    destinationLabel: txn.destination_label ?? attempt?.destination_label ?? null,
    startAt: txn.start_at ?? attempt?.start_at ?? null,
    endAt: txn.end_at ?? attempt?.end_at ?? null,
    offerSnapshot,
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const formatMoney = (cents: number | null | undefined) =>
    moneyValue(cents, currency, options?.formatCurrency);

  let y = height - 48;

  page.drawText(BRAND, {
    x: 48,
    y,
    size: 14,
    font: bold,
    color: ACCENT,
  });
  y -= 16;
  page.drawText("Official booking document · Event Travel Pass included", {
    x: 48,
    y,
    size: 9,
    font,
    color: MUTED,
  });
  y -= 12;
  page.drawLine({
    start: { x: 48, y },
    end: { x: width - 48, y },
    thickness: 1.25,
    color: ACCENT,
  });
  y -= 28;

  page.drawRectangle({
    x: 48,
    y: y - 90,
    width: width - 96,
    height: 104,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: RULE,
    borderWidth: 1,
  });

  const snapshotLeft = 60;
  const snapshotRight = 320;
  page.drawText("METADATA BLOCK", {
    x: snapshotLeft,
    y,
    size: 8,
    font: bold,
    color: MUTED,
  });
  y -= 16;
  page.drawText(clip(guestName, 42), {
    x: snapshotLeft,
    y,
    size: 13,
    font: bold,
    color: INK,
  });
  page.drawText(`Status: ${String(txn.status || "").replace(/_/g, " ")}`, {
    x: snapshotRight,
    y,
    size: 10,
    font: bold,
    color: INK,
  });
  y -= 16;
  page.drawText(
    `Payment Intent: ${clip(txn.payment_intent_id || attempt?.payment_intent_id || "—", 36)}`,
    {
      x: snapshotLeft,
      y,
      size: 9,
      font,
      color: INK,
    },
  );
  page.drawText(`Transaction: ${clip(txn.id, 28)}`, {
    x: snapshotRight,
    y,
    size: 9,
    font,
    color: INK,
  });
  y -= 14;
  const confirmedAt = txn.confirmed_at || attempt?.confirmed_at;
  page.drawText(
    `Pass date: ${
      confirmedAt ? new Date(confirmedAt).toLocaleString("en-US") : "—"
    }`,
    {
      x: snapshotLeft,
      y,
      size: 9,
      font,
      color: INK,
    },
  );
  page.drawText(`Account: ${clip(accountRef, 34)}`, {
    x: snapshotRight,
    y,
    size: 9,
    font,
    color: INK,
  });
  y -= 14;
  page.drawText(`Type: ${String(txn.kind || attempt?.kind || "—").toUpperCase()}`, {
    x: snapshotLeft,
    y,
    size: 9,
    font,
    color: INK,
  });
  page.drawText(
    `Provider: ${clip(txn.provider_key || attempt?.provider_key || "—", 24)}`,
    {
      x: snapshotRight,
      y,
      size: 9,
      font,
      color: INK,
    },
  );
  y -= 40;

  page.drawText("TABULAR ITEMIZATION", {
    x: 48,
    y,
    size: 10,
    font: bold,
    color: INK,
  });
  y -= 8;
  page.drawLine({
    start: { x: 48, y },
    end: { x: width - 48, y },
    thickness: 0.75,
    color: RULE,
  });
  y -= 18;

  const colLabel = 56;
  const colAmount = width - 56;
  const drawRow = (
    label: string,
    amount: string,
    emphasize = false,
    activeFont: PDFFont = font,
  ) => {
    const size = emphasize ? 11 : 10;
    const useFont = emphasize ? bold : activeFont;
    page.drawText(label, {
      x: colLabel,
      y,
      size,
      font: useFont,
      color: INK,
    });
    const amountWidth = useFont.widthOfTextAtSize(amount, size);
    page.drawText(amount, {
      x: colAmount - amountWidth,
      y,
      size,
      font: useFont,
      color: INK,
    });
    y -= emphasize ? 18 : 16;
  };

  drawRow("Base Fare", formatMoney(baseFareCents));
  drawRow("Tax Amount", formatMoney(taxCents));
  drawRow("Processing Fees", formatMoney(processingFeeCents));
  page.drawLine({
    start: { x: 48, y: y + 6 },
    end: { x: width - 48, y: y + 6 },
    thickness: 0.6,
    color: RULE,
  });
  drawRow("Total paid", formatMoney(totalCents), true);
  y -= 8;

  page.drawText("ITINERARY DETAILS", {
    x: 48,
    y,
    size: 10,
    font: bold,
    color: INK,
  });
  y -= 8;
  page.drawLine({
    start: { x: 48, y },
    end: { x: width - 48, y },
    thickness: 0.75,
    color: RULE,
  });
  y -= 18;

  for (const row of descriptors) {
    page.drawText(`${row.label}:`, {
      x: 56,
      y,
      size: 9,
      font: bold,
      color: MUTED,
    });
    page.drawText(clip(row.value, 70), {
      x: 150,
      y,
      size: 9,
      font,
      color: INK,
    });
    y -= 14;
    if (y < 240) break;
  }

  y = Math.min(y - 12, 230);
  const passHeight = 168;
  const passY = Math.max(40, y - passHeight);
  page.drawRectangle({
    x: 48,
    y: passY,
    width: width - 96,
    height: passHeight,
    color: PASS_BG,
    borderColor: ACCENT,
    borderWidth: 1.5,
  });

  page.drawText("EVENT TRAVEL PASS", {
    x: 64,
    y: passY + passHeight - 22,
    size: 12,
    font: bold,
    color: ACCENT,
  });
  page.drawText("Present this credential with a matching photo ID at check-in.", {
    x: 64,
    y: passY + passHeight - 38,
    size: 8,
    font,
    color: MUTED,
  });
  page.drawText(clip(guestName, 40), {
    x: 64,
    y: passY + passHeight - 58,
    size: 11,
    font: bold,
    color: INK,
  });
  page.drawText(
    `Supplier confirmation: ${confirmation || "PENDING — not yet issued"}`,
    {
      x: 64,
      y: passY + passHeight - 76,
      size: 9,
      font,
      color: INK,
    },
  );

  if (confirmation) {
    drawCode39Barcode(page, confirmation, 64, passY + 48, 280, 36);
    page.drawText(clip(confirmation, 36), {
      x: 64,
      y: passY + 32,
      size: 7,
      font,
      color: MUTED,
    });

    const qrPng = await QRCode.toBuffer(confirmation, {
      type: "png",
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#120f0f", light: "#FFFFFF" },
    });
    const qrImage = await pdf.embedPng(qrPng);
    const qrSize = 88;
    page.drawRectangle({
      x: width - 48 - qrSize - 18,
      y: passY + (passHeight - qrSize) / 2 - 4,
      width: qrSize + 12,
      height: qrSize + 12,
      color: WHITE,
      borderColor: RULE,
      borderWidth: 0.75,
    });
    page.drawImage(qrImage, {
      x: width - 48 - qrSize - 12,
      y: passY + (passHeight - qrSize) / 2 + 2,
      width: qrSize,
      height: qrSize,
    });
  } else {
    page.drawText("Barcode unavailable until supplier confirmation is issued.", {
      x: 64,
      y: passY + 56,
      size: 8,
      font,
      color: MUTED,
    });
  }

  page.drawText("COGIC Holy Convocation Travel Hub", {
    x: 64,
    y: passY + 14,
    size: 8,
    font,
    color: MUTED,
  });

  return pdf.save();
}
