"use client";

import { usePathname } from "next/navigation";
import DashboardMobileNav from "@/components/dashboard/DashboardMobileNav";

/** Shared-route primary dock — same component tree as the dashboard dock. */
export default function BottomNavigation() {
  const pathname = usePathname() || "/my-convocation";
  return <DashboardMobileNav pathname={pathname} />;
}
