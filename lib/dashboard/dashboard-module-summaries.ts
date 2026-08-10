import type { DashboardRegistrationState } from "@/lib/dashboard/load-attendee-dashboard";

export type DashboardTicketsSummary = {
  available: boolean;
  error: string | null;
  validCount: number;
  revokedCount: number;
  summary: string;
  cta: string;
};

export type DashboardHousingSummary = {
  available: boolean;
  error: string | null;
  preference: string | null;
  status: string | null;
  hotelName: string | null;
  blockName: string | null;
  arrival: string | null;
  departure: string | null;
  summary: string;
  cta: string;
};

export type DashboardModuleErrors = {
  tickets: string | null;
  housing: string | null;
  schedule: string | null;
  registration: string | null;
};

function label(value: string | null | undefined) {
  return (value || "unavailable").replaceAll("_", " ");
}

export function registrationHeadline(registration: DashboardRegistrationState, signedIn: boolean) {
  if (!signedIn || registration.status === "none") {
    return {
      title: "No Registration",
      summary: signedIn
        ? "Start registration for the 118th Holy Convocation."
        : "Sign in to register or view your registration.",
      cta: signedIn ? "Register" : "Sign In",
      href: signedIn ? "/register" : "/login?next=%2Fregister",
    };
  }

  switch (registration.status) {
    case "draft":
      return {
        title: "Registration In Progress",
        summary: "Continue your registration for the 118th Holy Convocation.",
        cta: "Continue Registration",
        href: "/register",
      };
    case "submitted":
      return {
        title: "Registration Submitted",
        summary: "Complete payment or review to finish registration.",
        cta: "Open Registration",
        href: "/register",
      };
    case "payment_pending":
      return {
        title: "Payment Pending",
        summary: "Your registration is waiting for payment confirmation.",
        cta: "Complete Payment",
        href: "/register/review",
      };
    case "confirmed":
      if (registration.credentialReady) {
        return {
          title: "Registration Confirmed",
          summary: "Your credential is ready. Show QR for secure entry.",
          cta: "View Credential",
          href: "/register",
        };
      }
      return {
        title: "Registration Confirmed",
        summary: "Credential pending. Check back when issuance completes.",
        cta: "Open Registration",
        href: "/register",
      };
    case "canceled":
      return {
        title: "Registration Canceled",
        summary: "This registration was canceled.",
        cta: "Open Registration",
        href: "/register",
      };
    case "refunded":
      return {
        title: "Registration Refunded",
        summary: "This registration was refunded.",
        cta: "Open Registration",
        href: "/register",
      };
    default:
      return {
        title: "My Registration",
        summary: `Status: ${label(registration.status)}`,
        cta: "Open Registration",
        href: "/register",
      };
  }
}

export function summarizeTickets(input: {
  error?: string | null;
  validCount: number;
  revokedCount: number;
  nearestTitle?: string | null;
}): DashboardTicketsSummary {
  if (input.error) {
    return {
      available: false,
      error: input.error,
      validCount: 0,
      revokedCount: 0,
      summary: "Unable to load tickets.",
      cta: "Try again",
    };
  }

  if (input.validCount > 0) {
    const title = input.nearestTitle?.trim();
    return {
      available: true,
      error: null,
      validCount: input.validCount,
      revokedCount: input.revokedCount,
      summary:
        input.validCount === 1
          ? title
            ? `1 issued ticket · ${title}`
            : "1 issued event ticket."
          : title
            ? `${input.validCount} issued tickets · Next: ${title}`
            : `${input.validCount} issued event tickets.`,
      cta: "View tickets & add-ons",
    };
  }

  if (input.revokedCount > 0) {
    return {
      available: true,
      error: null,
      validCount: 0,
      revokedCount: input.revokedCount,
      summary:
        input.revokedCount === 1
          ? "1 ticket was revoked."
          : `${input.revokedCount} tickets were revoked.`,
      cta: "View ticket history",
    };
  }

  return {
    available: true,
    error: null,
    validCount: 0,
    revokedCount: 0,
    summary: "No issued event tickets.",
    cta: "Buy tickets & add-ons",
  };
}

export function summarizeHousing(input: {
  error?: string | null;
  preference?: string | null;
  status?: string | null;
  hotelName?: string | null;
  blockName?: string | null;
  arrival?: string | null;
  departure?: string | null;
}): DashboardHousingSummary {
  if (input.error) {
    return {
      available: false,
      error: input.error,
      preference: null,
      status: null,
      hotelName: null,
      blockName: null,
      arrival: null,
      departure: null,
      summary: "Unable to load housing.",
      cta: "Try again",
    };
  }

  const preference = input.preference ?? null;
  const status = input.status ?? null;

  if (!preference && !status) {
    return {
      available: true,
      error: null,
      preference: null,
      status: null,
      hotelName: null,
      blockName: null,
      arrival: null,
      departure: null,
      summary: "No housing preference submitted.",
      cta: "Manage housing preferences",
    };
  }

  if (preference === "own_accommodations") {
    return {
      available: true,
      error: null,
      preference,
      status,
      hotelName: null,
      blockName: null,
      arrival: null,
      departure: null,
      summary: "Own accommodations selected.",
      cta: "Manage housing preferences",
    };
  }

  if (preference === "sharing_room") {
    return {
      available: true,
      error: null,
      preference,
      status,
      hotelName: null,
      blockName: null,
      arrival: null,
      departure: null,
      summary: "Sharing a room selected.",
      cta: "Manage housing preferences",
    };
  }

  if (preference === "book_later") {
    return {
      available: true,
      error: null,
      preference,
      status,
      hotelName: null,
      blockName: null,
      arrival: null,
      departure: null,
      summary: "Booking later selected.",
      cta: "Manage housing preferences",
    };
  }

  const parts = [
    input.hotelName || input.blockName,
    status ? label(status) : null,
    input.arrival && input.departure ? `${input.arrival} – ${input.departure}` : null,
  ].filter(Boolean);

  return {
    available: true,
    error: null,
    preference,
    status,
    hotelName: input.hotelName ?? null,
    blockName: input.blockName ?? null,
    arrival: input.arrival ?? null,
    departure: input.departure ?? null,
    summary: parts.length ? parts.join(" · ") : "Housing request submitted.",
    cta: "Manage housing preferences",
  };
}
