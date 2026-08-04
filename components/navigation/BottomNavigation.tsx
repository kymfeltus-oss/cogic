"use client";

import { usePathname } from "next/navigation";
import AttendeeLiveNavLink from "@/components/navigation/AttendeeLiveNavLink";
import Link from "next/link";
import { HeartHandshake, Home, Music2, Radio, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BOTTOM_NAV_HOTSPOTS,
  type BottomNavItemId,
} from "@/lib/navigation/bottom-nav-config";

const BOTTOM_NAV_ICONS: Record<BottomNavItemId, LucideIcon> = {
  home: Home,
  live: Radio,
  giving: HeartHandshake,
  music: Music2,
  "buy-seeds": Sprout,
};

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="bottom-dock">
      <div className="bottom-dock__frame">
        <div className="bottom-dock__items">
          {BOTTOM_NAV_HOTSPOTS.map((item) => {
            const active = item.isActive(pathname);
            const Icon = BOTTOM_NAV_ICONS[item.id];
            const className = `bottom-dock__item touch-target${active ? " bottom-dock__item--active" : ""}`;
            const content = (
              <>
                <span className="bottom-dock__icon-wrap" aria-hidden="true">
                  <Icon className="bottom-dock__icon" strokeWidth={2.25} />
                </span>
                <span className="bottom-dock__label">{item.label}</span>
              </>
            );

            if (item.id === "live") {
              return (
                <AttendeeLiveNavLink
                  key={item.id}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {content}
                </AttendeeLiveNavLink>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={className}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
