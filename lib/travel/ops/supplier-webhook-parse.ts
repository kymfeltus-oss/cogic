import { createDecipheriv, createHmac, scryptSync, timingSafeEqual } from "crypto";

export type SupplierChangeEventType =
  | "flight_time_change"
  | "cancellation"
  | "room_reassignment"
  | "status_update"
  | "other";

export type NormalizedSupplierWebhook = {
  providerKey: "expedia-rapid" | "duffel";
  eventType: SupplierChangeEventType;
  providerEventId: string | null;
  confirmationNumber: string | null;
  orderId: string | null;
  marketplaceAttemptId: string | null;
  transactionId: string | null;
  summary: string;
  changes: {
    departureAt?: string | null;
    arrivalAt?: string | null;
    checkIn?: string | null;
    checkOut?: string | null;
    roomName?: string | null;
    canceled?: boolean;
  };
  raw: Record<string, unknown>;
};

export function verifySupplierWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.TRAVEL_SUPPLIER_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { ok: false as const, reason: "TRAVEL_SUPPLIER_WEBHOOK_SECRET is not configured." };
  }
  if (!signatureHeader) {
    return { ok: false as const, reason: "Missing x-cogic-travel-signature header." };
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false as const, reason: "Invalid supplier webhook signature." };
  }
  return { ok: true as const };
}

/**
 * Optional AES-256-GCM envelope. Plain JSON payloads pass through unchanged.
 * Envelope shape: { encrypted: true, iv, tag, ciphertext } (base64 fields).
 */
export function decryptSupplierWebhookPayload(rawBody: string): {
  ok: true;
  plaintext: string;
} | { ok: false; reason: string } {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "Invalid JSON body." };
  }

  if (!parsed?.encrypted && !parsed?.ciphertext) {
    return { ok: true, plaintext: rawBody };
  }

  const secret = process.env.TRAVEL_SUPPLIER_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { ok: false, reason: "TRAVEL_SUPPLIER_WEBHOOK_SECRET is not configured." };
  }

  const ivB64 = String(parsed.iv || "");
  const tagB64 = String(parsed.tag || "");
  const cipherB64 = String(parsed.ciphertext || "");
  if (!ivB64 || !tagB64 || !cipherB64) {
    return { ok: false, reason: "Encrypted supplier payload is missing iv, tag, or ciphertext." };
  }

  try {
    const key = scryptSync(secret, "cogic-travel-supplier-webhook", 32);
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(cipherB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return { ok: true, plaintext };
  } catch {
    return { ok: false, reason: "Unable to decrypt supplier webhook payload." };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizeSupplierWebhookPayload(body: unknown): NormalizedSupplierWebhook | null {
  const root = asRecord(body);
  if (!root || Object.keys(root).length === 0) return null;

  if (root.provider || root.providerKey) {
    const providerRaw = String(root.provider || root.providerKey || "").toLowerCase();
    const providerKey =
      providerRaw === "duffel"
        ? "duffel"
        : providerRaw === "expedia-rapid" || providerRaw === "expedia"
          ? "expedia-rapid"
          : null;
    if (!providerKey) return null;
    const eventType = String(root.eventType || root.event_type || "status_update") as SupplierChangeEventType;
    const allowed: SupplierChangeEventType[] = [
      "flight_time_change",
      "cancellation",
      "room_reassignment",
      "status_update",
      "other",
    ];
    const changes = asRecord(root.changes);
    return {
      providerKey,
      eventType: allowed.includes(eventType) ? eventType : "other",
      providerEventId: root.providerEventId
        ? String(root.providerEventId)
        : root.event_id
          ? String(root.event_id)
          : null,
      confirmationNumber: root.confirmationNumber
        ? String(root.confirmationNumber)
        : root.booking_reference
          ? String(root.booking_reference)
          : null,
      orderId: root.orderId ? String(root.orderId) : root.itinerary_id ? String(root.itinerary_id) : null,
      marketplaceAttemptId: root.marketplaceAttemptId
        ? String(root.marketplaceAttemptId)
        : root.attemptId
          ? String(root.attemptId)
          : null,
      transactionId: root.transactionId ? String(root.transactionId) : null,
      summary: String(root.summary || `${providerKey} supplier notification`).slice(0, 1000),
      changes: {
        departureAt: changes.departureAt ? String(changes.departureAt) : null,
        arrivalAt: changes.arrivalAt ? String(changes.arrivalAt) : null,
        checkIn: changes.checkIn ? String(changes.checkIn) : null,
        checkOut: changes.checkOut ? String(changes.checkOut) : null,
        roomName: changes.roomName ? String(changes.roomName) : null,
        canceled: Boolean(changes.canceled) || eventType === "cancellation",
      },
      raw: root,
    };
  }

  const duffelType = String(root.type || "");
  if (duffelType.startsWith("order.") || asRecord(root.data).object) {
    const data = asRecord(root.data);
    const order = asRecord(data.object || data);
    const slices = Array.isArray(order.slices) ? order.slices : [];
    const firstSlice = asRecord(slices[0]);
    const segments = Array.isArray(firstSlice.segments) ? firstSlice.segments : [];
    const canceled =
      Boolean(order.cancelled_at) ||
      duffelType.includes("cancellation") ||
      /cancel/i.test(String(order.status || ""));
    const firstSeg = asRecord(segments[0]);
    const lastSeg = asRecord(segments[segments.length - 1]);
    return {
      providerKey: "duffel",
      eventType: canceled
        ? "cancellation"
        : duffelType.includes("airline_initiated_change")
          ? "flight_time_change"
          : "status_update",
      providerEventId: root.id ? String(root.id) : null,
      confirmationNumber: order.booking_reference ? String(order.booking_reference) : null,
      orderId: order.id ? String(order.id) : null,
      marketplaceAttemptId: null,
      transactionId: null,
      summary: canceled
        ? "Duffel reported an order cancellation."
        : "Duffel reported an order change.",
      changes: {
        departureAt: firstSeg.departing_at ? String(firstSeg.departing_at) : null,
        arrivalAt: lastSeg.arriving_at ? String(lastSeg.arriving_at) : null,
        canceled,
      },
      raw: root,
    };
  }

  if (root.itinerary_id || root.event_type || root.event_id) {
    const canceled = /cancel/i.test(String(root.event_type || root.status || ""));
    const roomReassign = /room/i.test(String(root.event_type || ""));
    return {
      providerKey: "expedia-rapid",
      eventType: canceled ? "cancellation" : roomReassign ? "room_reassignment" : "status_update",
      providerEventId: root.event_id ? String(root.event_id) : null,
      confirmationNumber: root.itinerary_id ? String(root.itinerary_id) : null,
      orderId: root.itinerary_id ? String(root.itinerary_id) : null,
      marketplaceAttemptId: null,
      transactionId: null,
      summary: canceled
        ? "Expedia Rapid reported an itinerary cancellation."
        : "Expedia Rapid reported an itinerary change.",
      changes: {
        checkIn: root.checkin ? String(root.checkin) : null,
        checkOut: root.checkout ? String(root.checkout) : null,
        roomName: root.room_name ? String(root.room_name) : null,
        canceled,
      },
      raw: root,
    };
  }

  return null;
}
