import Image from "next/image";
import { UserRound } from "lucide-react";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { chicagoDayGreeting, greetingName } from "@/lib/dashboard/greeting";

export default function DashboardTopBar({
  profile,
  profileReturnPath = "/my-convocation",
  onProfile,
}: {
  profile: AttendeeProfileSnapshot;
  profileReturnPath?: string;
  onProfile: () => void;
}) {
  const name = greetingName(profile.firstName);
  const greeting = chicagoDayGreeting();

  return (
    <header className="cl-topbar">
      <div className="cl-topbar__brand">
        <Image
          src="/my-sanctuary/cogic-live-logo.png"
          alt="COGIC LIVE"
          width={1250}
          height={270}
          priority
          sizes="(max-width: 720px) 148px, 168px"
          className="cl-topbar__logo"
        />
        <div className="cl-topbar__organization">
          <Image
            src="/branding/cogic-seal.png"
            alt="Church of God in Christ seal"
            width={96}
            height={64}
            sizes="48px"
            className="cl-topbar__seal"
          />
          <span>Church of God in Christ, Inc.</span>
        </div>
        <div className="cl-topbar__identity">
          <p className="cl-topbar__greeting">{greeting}{name ? `, ${name}` : ""}</p>
          <p className="cl-topbar__context">Home</p>
        </div>
      </div>

      {profile.userId ? (
        <button
          type="button"
          className="cl-topbar__profile"
          onClick={onProfile}
          aria-label="Open attendee profile"
        >
          {profile.avatarUrl ? (
            <Image src={profile.avatarUrl} alt="" width={40} height={40} unoptimized />
          ) : (
            <span className="cl-topbar__avatar">
              <UserRound aria-hidden="true" />
            </span>
          )}
        </button>
      ) : (
        <a
          href={`/login?next=${encodeURIComponent(profileReturnPath)}`}
          className="cl-btn cl-btn--compact"
        >
          Sign in
        </a>
      )}
    </header>
  );
}
