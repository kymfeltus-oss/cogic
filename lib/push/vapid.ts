import "server-only";

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

/** Server-only VAPID config. Private key never leaves the server. */
export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    "mailto:support@cogiclive.com";

  if (!publicKey || !privateKey) return null;

  return {
    publicKey,
    privateKey,
    subject: subject.startsWith("mailto:") ? subject : `mailto:${subject}`,
  };
}

export function isWebPushConfigured(): boolean {
  return getVapidConfig() !== null;
}

/** Safe public payload only — never includes the private key. */
export function getPublicVapidKey(): string | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  return publicKey || null;
}
