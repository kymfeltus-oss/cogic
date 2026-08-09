"use client";

import { usePathname } from "next/navigation";
import BrandBackdrop, { brandVariantFromPath } from "@/components/brand/BrandBackdrop";
import AttendeeSharedTopBar from "@/components/navigation/AttendeeSharedTopBar";
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
  // Dashboards mount their own universal top bar + bottom dock once.
  const hasSharedNavigation = !hideNav && !isCogicDashboard;
  const atmosphereVariant = brandVariantFromPath(pathname);

  if (isCredentialRoute) {
    return (
      <div className="relative min-h-dvh w-full bg-transparent">
        <BrandBackdrop variant="default" />
        {children}
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-dvh w-full bg-transparent", isCogicDashboard && "bg-[#03040a]")}>
      {!isCogicDashboard && <BrandBackdrop variant={atmosphereVariant} />}
      {hasSharedNavigation && <AttendeeSharedTopBar />}
      {hasSharedNavigation && <BottomNavigation />}
      <div
        className={cn(
          "relative z-[1] w-full",
          useFlexViewportShell
            ? "flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden"
            : "min-h-dvh",
          hasSharedNavigation && "cl-global-stage",
          !hideNav && !isExperienceDashboard && !isCogicDashboard && !isArtboardTab && CONTENT_WITH_NAV,
        )}
      >
        {children}
      </div>
    </div>
  );
}
