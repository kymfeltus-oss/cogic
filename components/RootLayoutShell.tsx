"use client";

import { usePathname } from "next/navigation";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import { CONTENT_WITH_NAV } from "@/lib/responsive";
import { isCredentialPublicRoute, isFullHeightArtboardRoute, isMobileArtboardTabRoute, isNavHiddenRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

type RootLayoutShellProps = {
  children: React.ReactNode;
};

export default function RootLayoutShell({ children }: RootLayoutShellProps) {
  const pathname = usePathname();
  const isCredentialRoute = isCredentialPublicRoute(pathname);
  const hideNav = isNavHiddenRoute(pathname);
  // Legacy Awakening artboard only — COGIC My Convocation uses normal page chrome.
  const isExperienceDashboard = pathname === "/attendee-dashboard";
  const isCogicDashboard = pathname === "/my-convocation" || pathname === "/my-sanctuary";
  const isArtboardTab = isMobileArtboardTabRoute(pathname);
  const isFullHeightArtboard = isFullHeightArtboardRoute(pathname);
  const useFlexViewportShell = isArtboardTab || isFullHeightArtboard;

  if (isCredentialRoute) {
    return <div className="min-h-dvh w-full bg-brand-midnight">{children}</div>;
  }

  return (
    <div className="min-h-dvh w-full bg-transparent">
      {!hideNav && !isCogicDashboard && <BottomNavigation />}
      <div
        className={cn(
          "w-full",
          useFlexViewportShell
            ? "flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden"
            : "min-h-dvh",
          !hideNav && !isExperienceDashboard && !isCogicDashboard && !isArtboardTab && CONTENT_WITH_NAV,
        )}
      >
        {children}
      </div>
    </div>
  );
}
