import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardList, Check } from "lucide-react";
import type { DashboardRegistrationState } from "@/lib/dashboard/load-attendee-dashboard";

function content(registration: DashboardRegistrationState, signedIn: boolean) {
  if (!signedIn) {
    return [
      "No Registration",
      "Sign in to start or review your registration.",
      "Sign In",
      "/login?next=%2Fregister",
    ] as const;
  }
  if (registration.credentialReady) {
    return [
      "Credential Ready",
      "Your confirmed Convocation credential has been issued.",
      "Review Registration",
      "/register",
    ] as const;
  }
  switch (registration.status) {
    case "draft":
      return [
        "Registration In Progress",
        "Your registration has been saved as a draft.",
        "Continue Registration",
        "/register",
      ] as const;
    case "submitted":
      return [
        "Registration Submitted",
        "Your information is on file. Complete payment to confirm registration.",
        "Complete Payment",
        "/register",
      ] as const;
    case "payment_pending":
      return [
        "Payment Pending",
        "Complete the remaining payment step.",
        "Complete Payment",
        "/register",
      ] as const;
    case "confirmed":
      return [
        "Registration Complete",
        "Your Convocation registration is confirmed.",
        "Review Registration",
        "/register",
      ] as const;
    default:
      return [
        "No Registration",
        "Start your registration for the 118th Holy Convocation.",
        "Start Your Registration",
        "/register",
      ] as const;
  }
}

export default function MyConvocationCard({
  registration,
  signedIn,
}: {
  registration: DashboardRegistrationState;
  signedIn: boolean;
}) {
  const [title, body, label, href] = content(registration, signedIn);

  return (
    <article className="cl-feature-card cl-feature-card--registration">
      <p className="cl-feature-card__eyebrow">My Convocation</p>
      <div className="cl-feature-card__credential-icon">
        {registration.credentialReady ? (
          <BadgeCheck aria-hidden="true" />
        ) : (
          <ClipboardList aria-hidden="true" />
        )}
      </div>
      <div className="cl-feature-card__status"><strong>{title}</strong>{signedIn && registration.status === "confirmed" ? <Check aria-hidden="true" /> : null}</div>
      <p className="cl-feature-card__body">{body}</p>
      <Link href={href} className="cl-btn cl-btn--primary cl-btn--block">
        {label}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <Link href="/my-convocation" className="cl-btn cl-btn--ghost cl-btn--block">Open My Convocation</Link>
    </article>
  );
}
