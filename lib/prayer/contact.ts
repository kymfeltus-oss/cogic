/** Prayer & contact destinations — single source of truth for overlay links. */

/** Operator: set NEXT_PUBLIC_SUPPORT_EMAIL to the official COGIC LIVE mailbox before launch. */
export const PRAYER_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@example.com";

export const PRAYER_CONTACT = {
  email: PRAYER_CONTACT_EMAIL,
  website: process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://example.com",
  prayerRequestMailto: `mailto:${PRAYER_CONTACT_EMAIL}?subject=${encodeURIComponent("Prayer Request")}&body=${encodeURIComponent("Please share your prayer request below:\n\n")}`,
  emailMailto: `mailto:${PRAYER_CONTACT_EMAIL}`,
} as const;

export function buildContactMailto(input: {
  fullName: string;
  email: string;
  subject: string;
  message: string;
}): string {
  const subject = input.subject.trim() || "Contact from COGIC LIVE";
  const body = [
    `Name: ${input.fullName.trim()}`,
    `Email: ${input.email.trim()}`,
    "",
    input.message.trim(),
  ].join("\n");

  return `mailto:${PRAYER_CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Social destinations — configure official COGIC LIVE profiles before launch. */
export const PRAYER_SOCIAL_LINKS = [] as const;
