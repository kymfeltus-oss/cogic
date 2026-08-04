/** Prayer & contact destinations — single source of truth for overlay links. */

export const PRAYER_CONTACT_EMAIL = "info@vitalorgansent.com";

export const PRAYER_CONTACT = {
  email: PRAYER_CONTACT_EMAIL,
  website: "https://www.vitalorgansent.com",
  prayerRequestMailto: `mailto:${PRAYER_CONTACT_EMAIL}?subject=${encodeURIComponent("Prayer Request")}&body=${encodeURIComponent("Please share your prayer request below:\n\n")}`,
  emailMailto: `mailto:${PRAYER_CONTACT_EMAIL}`,
} as const;

export function buildContactMailto(input: {
  fullName: string;
  email: string;
  subject: string;
  message: string;
}): string {
  const subject = input.subject.trim() || "Contact from 300 Awakening";
  const body = [
    `Name: ${input.fullName.trim()}`,
    `Email: ${input.email.trim()}`,
    "",
    input.message.trim(),
  ].join("\n");

  return `mailto:${PRAYER_CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const PRAYER_SOCIAL_LINKS = [
  {
    id: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/vitalorgansent",
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/vitalorgans_ent/",
  },
  {
    id: "youtube",
    label: "YouTube",
    href: "https://www.youtube.com/@vitalorgansent",
  },
  {
    id: "tiktok",
    label: "TikTok",
    href: "https://www.tiktok.com/@vitalorgansent",
  },
  {
    id: "x",
    label: "X",
    href: "https://x.com/vitalorgansent",
  },
] as const;
