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
  const isMyRegistration =
    pathname === "/my-convocation/registration" ||
    pathname.startsWith("/my-convocation/registration/");
  const isRegisterFlow = pathname === "/register" || pathname.startsWith("/register/");
  const isGiving =
    pathname === "/giving" || pathname.startsWith("/giving/");
  const isTravelShell =
    pathname === "/travel" || pathname.startsWith("/travel/");
  const isIntro = pathname === "/intro" || pathname.startsWith("/intro/");
  const isArtboardTab = isMobileArtboardTabRoute(pathname);
  const isDigitalProgram = pathname === "/digital-program";
  const isFullHeightArtboard = isFullHeightArtboardRoute(pathname);
  const useFlexViewportShell = isArtboardTab || isFullHeightArtboard;
  // Dashboards / travel mount their own mobile chrome — no shared attendee nav.
  // Registration + Giving keep the dock, but drop the shared logo topbar.
  const hasSharedDock = !hideNav && !isCogicDashboard && !isTravelShell;
  const hasSharedTopBar =
    hasSharedDock && !isMyRegistration && !isRegisterFlow && !isGiving && !isDigitalProgram;
  const useSolidScrollingSurface =
    isCogicDashboard ||
    isTravelShell ||
    isMyRegistration ||
    isRegisterFlow ||
    isGiving;
  const atmosphereVariant = brandVariantFromPath(pathname);
  // Full-bleed intro owns the first paint — skip global watermark so it cannot steal LCP.
  const showBrandBackdrop = !useSolidScrollingSurface && !isIntro && !isDigitalProgram;

  if (isCredentialRoute) {
    return (
      <div className="relative min-h-dvh w-full bg-transparent">
        <BrandBackdrop variant="default" />
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative min-h-dvh w-full",
        useSolidScrollingSurface ? "bg-[#07040f]" : "bg-transparent",
      )}
    >
      {showBrandBackdrop && <BrandBackdrop variant={atmosphereVariant} />}
      {hasSharedTopBar && <AttendeeSharedTopBar />}
      {hasSharedDock && <BottomNavigation />}
      <div
        className={cn(
          "relative z-[1] w-full",
          useFlexViewportShell
            ? "flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden"
            : "min-h-dvh",
          hasSharedDock && "cl-global-stage",
          !hideNav &&
            !isExperienceDashboard &&
            !isCogicDashboard &&
            !isTravelShell &&
            !isArtboardTab &&
            CONTENT_WITH_NAV,
        )}
      >
        {children}
      </div>
    </div>
  );
}
