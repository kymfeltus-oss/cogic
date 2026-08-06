import Image from "next/image";
import { Bell, ChevronDown, Search, UserRound } from "lucide-react";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

export default function DashboardTopBar({
  profile,
  profileReturnPath = "/my-convocation",
  onProfile,
}: {
  profile: AttendeeProfileSnapshot;
  profileReturnPath?: string;
  onProfile: () => void;
}) {
  const welcomeName = profile.title && profile.lastName
    ? `${profile.title} ${profile.lastName}`
    : profile.firstName || "Guest";

  return (
    <header className="cl-topbar">
      <div className="cl-topbar__brand">
        <Image
          src="/my-sanctuary/cogic-live-logo-purple.png"
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
      </div>

      <div className="cl-topbar__tools" aria-label="Dashboard tools">
        <div className="cl-topbar__search" role="search" aria-label="Search COGIC LIVE">
          <Search aria-hidden="true" />
          <span>Search COGIC LIVE</span>
        </div>
        <Bell className="cl-topbar__bell" aria-hidden="true" />
        <span className="cl-topbar__divider" aria-hidden="true" />

      {profile.userId ? (
        <div className="cl-topbar__account">
          <button type="button" className="cl-topbar__profile" onClick={onProfile} aria-label="Open attendee profile">
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt="" width={40} height={40} unoptimized />
            ) : (
              <span className="cl-topbar__avatar" aria-hidden="true">
                {profile.profileInitials || <UserRound />}
              </span>
            )}
          </button>
          <button type="button" className="cl-topbar__account-copy" onClick={onProfile}>
            <strong>{welcomeName}</strong>
            <span>Attendee</span>
          </button>
          <ChevronDown className="cl-topbar__chevron" aria-hidden="true" />
        </div>
      ) : (
        <a
          href={`/login?next=${encodeURIComponent(profileReturnPath)}`}
          className="cl-btn cl-btn--compact"
        >
          Sign in
        </a>
      )}
      </div>
    </header>
  );
}
