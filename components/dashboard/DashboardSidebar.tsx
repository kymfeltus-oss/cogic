/**
 * @deprecated Side rail removed — desktop navigation lives in AttendeeDesktopNav / DashboardTopBar.
 * Kept as a thin compatibility surface for contract tests and any lingering imports.
 */
export { ATTENDEE_DESKTOP_NAV as dashboardSidebarItems } from "@/lib/navigation/attendee-desktop-nav";

export const DASHBOARD_SIDEBAR_LOGO = "/my-sanctuary/cogic-live-logo-purple.png";

export default function DashboardSidebar() {
  return null;
}
