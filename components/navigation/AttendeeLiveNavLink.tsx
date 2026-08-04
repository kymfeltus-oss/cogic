"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import {
  ATTENDEE_LIVE_NAV_FALLBACK,
  useAttendeeLiveNavTarget,
} from "@/lib/experience/useAttendeeLiveNavTarget";

type AttendeeLiveNavLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  initialCountdownConfig?: EventCountdownConfig;
};

/** Live tab / menu link — routes to `/live`. */
export default function AttendeeLiveNavLink({
  initialCountdownConfig,
  children,
  ...rest
}: AttendeeLiveNavLinkProps) {
  const { href, isLoading } = useAttendeeLiveNavTarget({
    initialConfig: initialCountdownConfig,
  });

  return (
    <Link href={isLoading ? ATTENDEE_LIVE_NAV_FALLBACK : href} {...rest}>
      {children}
    </Link>
  );
}
