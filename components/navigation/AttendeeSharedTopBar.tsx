"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AttendeeDesktopNav from "@/components/navigation/AttendeeDesktopNav";

/** Live Hub–style top chrome for attendee pages that do not own a custom header. */
export default function AttendeeSharedTopBar() {
  const pathname = usePathname() || "/";

  return (
    <header className="cl-topbar cl-topbar--shared">
      <div className="cl-topbar__brand">
        <Link href="/my-convocation" className="cl-topbar__brand-link" aria-label="COGIC LIVE home">
          <Image
            src="/branding/cogic-seal.png"
            alt=""
            width={72}
            height={72}
            className="cl-topbar__seal"
            priority
          />
          <Image
            src="/my-sanctuary/cogic-live-logo-purple.png"
            alt="COGIC LIVE"
            width={1250}
            height={270}
            priority
            sizes="168px"
            className="cl-topbar__logo"
          />
        </Link>
      </div>

      <AttendeeDesktopNav pathname={pathname} ariaLabel="Primary desktop" />

      <div className="cl-topbar__tools cl-topbar__tools--shared">
        <Link href="/my-convocation?view=profile" className="cl-btn cl-btn--compact">
          My Account
        </Link>
      </div>
    </header>
  );
}
