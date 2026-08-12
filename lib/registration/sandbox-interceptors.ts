import "server-only";

import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { isMockRegistrationEnabled } from "@/lib/registration/runtime-mode";

function sandboxId(prefix: string, source: string) {
  return `${prefix}_sandbox_${createHash("sha256").update(source).digest("hex").slice(0, 20)}`;
}

export function interceptRegistrationCheckout(input: { registrationId: string; appUrl: string }) {
  if (!isMockRegistrationEnabled()) return null;
  const sessionId = sandboxId("cs", input.registrationId);
  return {
    id: sessionId,
    object: "checkout.session" as const,
    mode: "payment" as const,
    payment_status: "unpaid" as const,
    status: "open" as const,
    livemode: false,
    url: `${input.appUrl}/register/review?checkout=sandbox&session_id=${encodeURIComponent(sessionId)}`,
    sandbox: true as const,
  };
}

export async function interceptRegistrationCredential(input: { registrationId: string; registrationType: string }) {
  if (!isMockRegistrationEnabled()) return null;
  const credentialId = sandboxId("cred", input.registrationId);
  const presentationUrl = `https://sandbox.invalid/c/${credentialId}`;
  return {
    id: credentialId,
    object: "registration.credential" as const,
    status: "sandbox" as const,
    registrationType: input.registrationType,
    qrDataUrl: await QRCode.toDataURL(presentationUrl, { errorCorrectionLevel: "M", width: 640, margin: 3 }),
    sandbox: true as const,
    persisted: false as const,
  };
}
