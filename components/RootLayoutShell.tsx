"use client";

import { usePathname } from "next/navigation";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";
import { CONTENT_WITH_NAV } from "@/lib/responsive";
import { isFullHeightArtboardRoute, isMobileArtboardTabRoute, isNavHiddenRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

type RootLayoutShellProps = {
  children: React.ReactNode;
};

export default function RootLayoutShell({ children }: RootLayoutShellProps) {
  const pathname = usePathname();
  const hideNav = isNavHiddenRoute(pathname);
  const isExperienceDashboard = pathname === ATTENDEE_DASHBOARD_PATH;
  const isArtboardTab = isMobileArtboardTabRoute(pathname);
  const isFullHeightArtboard = isFullHeightArtboardRoute(pathname);
  const useFlexViewportShell = isArtboardTab || isFullHeightArtboard;

  return (
    <div className="min-h-dvh w-full bg-transparent">
      {!hideNav && <BottomNavigation />}
      <div
        className={cn(
          "w-full",
          useFlexViewportShell
            ? "flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden"
            : "min-h-dvh",
          !hideNav && !isExperienceDashboard && !isArtboardTab && CONTENT_WITH_NAV,
        )}
      >
        {children}
      </div>
    </div>
  );
}
