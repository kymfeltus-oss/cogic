import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardList } from "lucide-react";
import DashboardCard from "@/components/dashboard/DashboardCard";
import type { DashboardRegistrationState } from "@/lib/dashboard/load-attendee-dashboard";

function content(registration: DashboardRegistrationState, signedIn: boolean) {
  if (!signedIn) return ["No Registration", "Sign in to start or review your registration.", "Sign In", "/login?next=%2Fregister"] as const;
  if (registration.credentialReady) return ["Credential Ready", "Your confirmed Convocation credential has been issued.", "Review Registration", "/register"] as const;
  switch (registration.status) {
    case "draft": return ["Registration In Progress", "Your registration has been saved as a draft.", "Continue Registration", "/register"] as const;
    case "submitted": return ["Registration Submitted", "Your information has been received for review.", "Review Registration", "/register"] as const;
    case "payment_pending": return ["Payment Pending", "Complete the remaining payment step.", "Complete Payment", "/register"] as const;
    case "confirmed": return ["Registration Complete", "Your Convocation registration is confirmed.", "Review Registration", "/register"] as const;
    default: return ["No Registration", "Start your registration for the 118th Holy Convocation.", "Start Your Registration", "/register"] as const;
  }
}

export default function MyConvocationCard({ registration, signedIn }: { registration: DashboardRegistrationState; signedIn: boolean }) {
  const [title, body, label, href] = content(registration, signedIn);
  return (
    <DashboardCard title="My Convocation" className="registration-card">
      <div className="registration-card__icon">{registration.credentialReady ? <BadgeCheck aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}</div>
      <strong>{title}</strong><p>{body}</p>
      <Link href={href} className="dashboard-button dashboard-button--outline">{label}<ArrowRight aria-hidden="true" /></Link>
    </DashboardCard>
  );
}
