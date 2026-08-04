"use client";

import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import AwakeningMenuButton from "@/components/AwakeningMenuButton";
import ProfileOrbEditor from "@/components/profile/ProfileOrbEditor";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { cn } from "@/lib/utils";

type MobileNativeHeaderProps = {
  title?: string;
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
  leading?: "back" | "close" | "menu" | "none";
  backHref?: string;
  backLabel?: string;
  scrolled?: boolean;
  className?: string;
};

export default function MobileNativeHeader({
  title,
  profile,
  onProfileChange,
  leading = "back",
  backHref = ATTENDEE_DASHBOARD_PATH,
  backLabel = "Back to dashboard",
  scrolled = true,
  className,
}: MobileNativeHeaderProps) {
  const hasLeading = leading !== "none";
  const LeadingIcon = leading === "close" ? X : ChevronLeft;

  return (
    <header
      className={cn(
        "mobile-native-header",
        !hasLeading && "mobile-native-header--no-leading",
        className,
      )}
      data-scrolled={scrolled ? "true" : "false"}
      aria-label={title ? `${title} navigation` : "Page navigation"}
    >
      {leading === "menu" ? (
        <div className="mobile-native-header__leading">
          <AwakeningMenuButton />
        </div>
      ) : hasLeading ? (
        <Link href={backHref} aria-label={backLabel} className="mobile-native-header__leading">
          <LeadingIcon className="mobile-native-header__icon" aria-hidden="true" strokeWidth={2.5} />
        </Link>
      ) : null}

      <div className="mobile-native-header__title font-ui">
        {title ? <span>{title}</span> : null}
      </div>

      <div className="mobile-native-header__actions">
        <div className="mobile-native-header__action mobile-native-header__action--profile" aria-label="Profile">
          <ProfileOrbEditor profile={profile} onProfileChange={onProfileChange} size={48} />
        </div>
        <div className="mobile-native-header__action">
          <AwakeningMenuButton />
        </div>
      </div>
    </header>
  );
}
