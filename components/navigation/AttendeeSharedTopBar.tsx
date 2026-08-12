"use client";

import Image from "next/image";
import Link from "next/link";
import { UserRound } from "lucide-react";
import "./attendee-shared-topbar.css";

/** Universal attendee top chrome — same mobile header structure as the dashboard. */
export default function AttendeeSharedTopBar() {
  return (
    <header className="cl-topbar cl-topbar--shared">
      <div className="cl-topbar__phrase-wrap">
        <Image
          src="/my-sanctuary/cogic-phrase.png"
          alt="The Church of God in Christ"
          width={1535}
          height={1024}
          priority
          sizes="(max-width: 720px) 82vw, 320px"
          className="cl-topbar__phrase"
        />
      </div>

      <div className="cl-topbar__brand">
        <Link href="/my-convocation" className="cl-topbar__brand-link" aria-label="COGIC LIVE home">
          <Image
            src="/my-sanctuary/cogic-live-logo-purple.png"
            alt="COGIC LIVE"
            width={1250}
            height={270}
            priority
            sizes="116px"
            className="cl-topbar__logo"
          />
        </Link>
      </div>

      <div className="cl-topbar__tools cl-topbar__tools--shared">
        <Link
          href="/my-convocation?view=profile"
          className="cl-topbar__profile"
          aria-label="Open My Account"
        >
          <span className="cl-topbar__avatar" aria-hidden="true">
            <UserRound />
          </span>
        </Link>
      </div>
    </header>
  );
}
