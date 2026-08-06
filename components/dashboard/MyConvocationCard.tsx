import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardList } from "lucide-react";
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
        "Your information has been received for review.",
        "Review Registration",
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
    <article className="cl-action-card">
      <div className="cl-action-card__icon">
        {registration.credentialReady ? (
          <BadgeCheck aria-hidden="true" />
        ) : (
          <ClipboardList aria-hidden="true" />
        )}
      </div>
      <p className="cl-action-card__eyebrow">My Registration</p>
      <h3 className="cl-action-card__title">{title}</h3>
      <p className="cl-action-card__body">{body}</p>
      <Link href={href} className="cl-btn cl-btn--ghost cl-btn--block">
        {label}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
