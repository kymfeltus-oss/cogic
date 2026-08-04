import type { User } from "@supabase/supabase-js";

/** Derive attendee-facing profile labels from verified Supabase identity. */

export type UserProfileDisplay = {
  firstName: string;
  lastName: string;
  headerDisplayName: string;
  profileInitials: string;
  initialsSource: "metadata" | "attendees" | "email" | "guest";
};

type NameFields = {
  firstName: string;
  lastName: string;
};

function normalizeNamePart(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

/** Read first/last name from Supabase auth user_metadata (supports snake and camelCase). */
export function parseNameFieldsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): NameFields {
  if (!metadata) {
    return { firstName: "", lastName: "" };
  }

  const firstName = normalizeNamePart(metadata.first_name ?? metadata.firstName);
  const lastName = normalizeNamePart(metadata.last_name ?? metadata.lastName);

  return { firstName, lastName };
}

export function firstNameFromEmail(email: string | null | undefined): string {
  if (!email?.trim()) return "Guest";

  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  const parts = local.replace(/[._+-]/g, " ").split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "guest";

  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Uppercase header label — falls back to GUEST for anonymous users. */
export function awakeningHeaderDisplayName(firstName: string): string {
  const trimmed = firstName.trim();
  if (!trimmed || trimmed.toLowerCase() === "guest") {
    return "GUEST";
  }
  return trimmed.toUpperCase();
}

export function initialsFromIdentity(
  email: string | null | undefined,
  displayName?: string | null,
): string {
  const trimmedDisplay = displayName?.trim();
  if (trimmedDisplay) {
    const parts = trimmedDisplay.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return trimmedDisplay.slice(0, 2).toUpperCase();
  }

  if (!email?.trim()) return "G";

  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  const parts = local.replace(/[._+-]/g, " ").split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }

  const single = parts[0] ?? local;
  if (single.length >= 2) return single.slice(0, 2).toUpperCase();
  return single.charAt(0).toUpperCase();
}

function initialsFromNameFields(firstName: string, lastName: string): string | null {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  return null;
}

function profileFromNameFields(
  firstName: string,
  lastName: string,
  initialsSource: "metadata" | "attendees",
): UserProfileDisplay | null {
  const profileInitials = initialsFromNameFields(firstName, lastName);
  if (!profileInitials) return null;

  return {
    firstName,
    lastName,
    headerDisplayName: awakeningHeaderDisplayName(firstName),
    profileInitials,
    initialsSource,
  };
}

/** Resolve welcome header + profile orb initials from a verified Supabase user. */
export function resolveUserProfileDisplay(
  user: User | null,
  attendeeNames?: { firstName: string; lastName: string } | null,
): UserProfileDisplay {
  if (!user) {
    return {
      firstName: "Guest",
      lastName: "",
      headerDisplayName: "GUEST",
      profileInitials: "G",
      initialsSource: "guest",
    };
  }

  const isGuest = user.user_metadata?.is_guest === true;
  const metadataNames = parseNameFieldsFromMetadata(user.user_metadata);
  const metadataProfile = profileFromNameFields(
    metadataNames.firstName,
    metadataNames.lastName,
    "metadata",
  );

  if (metadataProfile) {
    return metadataProfile;
  }

  if (attendeeNames) {
    const attendeeProfile = profileFromNameFields(
      attendeeNames.firstName,
      attendeeNames.lastName,
      "attendees",
    );
    if (attendeeProfile) {
      return attendeeProfile;
    }
  }

  if (isGuest) {
    return {
      firstName: "Guest",
      lastName: "",
      headerDisplayName: "GUEST",
      profileInitials: "G",
      initialsSource: "guest",
    };
  }

  const emailFirstName = firstNameFromEmail(user.email);
  const { firstName: metaFirst, lastName: metaLast } = parseNameFieldsFromMetadata(
    user.user_metadata,
  );
  const fallbackDisplayName =
    metaFirst && !metaLast ? metaFirst : metaLast && !metaFirst ? metaLast : emailFirstName;

  return {
    firstName: fallbackDisplayName,
    lastName: "",
    headerDisplayName: awakeningHeaderDisplayName(fallbackDisplayName),
    profileInitials: initialsFromIdentity(user.email, fallbackDisplayName),
    initialsSource: "email",
  };
}
