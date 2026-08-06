"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import AttendeeLiveNavLink from "@/components/navigation/AttendeeLiveNavLink";
import { PERSONA_HUB_PATH } from "@/lib/auth/routing";
import { isAttendeeLiveSurfacePath, EXPERIENCE_LIVE_PATH } from "@/lib/experience/live-routes";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";
import { cn } from "@/lib/utils";

export type AwakeningMenuItem = {
  id: string;
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

export const AWAKENING_MENU_ITEMS: AwakeningMenuItem[] = [
  { id: "home", label: "Home", href: ATTENDEE_DASHBOARD_PATH, match: "prefix" },
  { id: "live", label: "Live Room", href: EXPERIENCE_LIVE_PATH, match: "prefix" },
  { id: "program", label: "Program", href: "/program", match: "prefix" },
  { id: "seed", label: "COGIC Giving", href: "/giving", match: "prefix" },
  { id: "music", label: "Music", href: "/experience/music", match: "prefix" },
  { id: "contact", label: "Contact", href: "/experience/contact-us", match: "prefix" },
  { id: "profile", label: "Profile", href: `${ATTENDEE_DASHBOARD_PATH}?view=profile` },
];

type AwakeningMenuButtonProps = {
  className?: string;
  items?: AwakeningMenuItem[];
};

function isMenuItemActive(pathname: string, item: AwakeningMenuItem): boolean {
  if (item.id === "live") {
    return isAttendeeLiveSurfacePath(pathname);
  }

  if (!item.match) return false;

  const hrefPath = item.href.split("?")[0] ?? item.href;

  if (item.match === "exact") {
    return pathname === hrefPath;
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

export default function AwakeningMenuButton({
  className,
  items = AWAKENING_MENU_ITEMS,
}: AwakeningMenuButtonProps) {
  const panelId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(closeMenu);
    return () => window.cancelAnimationFrame(frame);
  }, [closeMenu, pathname]);

  const handleLogout = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        closeMenu();
        router.refresh();
        router.push(PERSONA_HUB_PATH);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={cn("awakening-menu-button touch-target", className)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className="awakening-menu-icon"
          data-open={open ? "true" : "false"}
          aria-hidden
        >
          <span className="awakening-menu-bar awakening-menu-bar--1" />
          <span className="awakening-menu-bar awakening-menu-bar--2" />
          <span className="awakening-menu-bar awakening-menu-bar--3" />
        </span>
      </button>

      {mounted
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close menu backdrop"
                className={cn(
                  "awakening-menu-backdrop",
                  open && "awakening-menu-backdrop--open",
                )}
                onClick={closeMenu}
                tabIndex={open ? 0 : -1}
              />

              <aside
                id={panelId}
                className={cn(
                  "awakening-menu-panel",
                  open && "awakening-menu-panel--open",
                )}
                aria-hidden={!open}
                inert={!open ? true : undefined}
              >
                <div className="awakening-menu-panel-header">
                  <p className="font-ui text-[0.62rem] font-semibold uppercase tracking-[0.38em] text-brand-blue">
                    COGIC LIVE
                  </p>
                  <p className="font-headline mt-1 text-lg uppercase tracking-[0.14em] text-white">
                    Menu
                  </p>
                </div>

                <nav aria-label="COGIC LIVE menu" className="awakening-menu-nav">
                  <ul className="flex flex-col gap-1">
                    {items.map((item) => {
                      const active = isMenuItemActive(pathname, item);
                      const linkClassName = cn(
                        "awakening-menu-link font-ui",
                        active && "awakening-menu-link--active",
                      );

                      return (
                        <li key={item.id}>
                          {item.id === "live" ? (
                            <AttendeeLiveNavLink
                              className={linkClassName}
                              onClick={closeMenu}
                              tabIndex={open ? 0 : -1}
                            >
                              {item.label}
                            </AttendeeLiveNavLink>
                          ) : (
                            <Link
                              href={item.href}
                              className={linkClassName}
                              onClick={closeMenu}
                              tabIndex={open ? 0 : -1}
                            >
                              {item.label}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div className="awakening-menu-footer">
                  <button
                    type="button"
                    className="awakening-menu-logout font-ui"
                    onClick={(event) => void handleLogout(event)}
                    disabled={isLoggingOut}
                    tabIndex={open ? 0 : -1}
                  >
                    {isLoggingOut ? "Signing out…" : "Logout"}
                  </button>
                </div>
              </aside>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
