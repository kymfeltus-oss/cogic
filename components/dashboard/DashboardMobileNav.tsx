import Link from "next/link";
import { CalendarDays, HandHeart, Home, IdCard, Radio } from "lucide-react";

const items = [["Home", "/my-convocation", Home], ["Live", "/live", Radio], ["Schedule", "/program", CalendarDays], ["Giving", "/giving", HandHeart], ["Mine", "/register", IdCard]] as const;
export default function DashboardMobileNav({ homeHref = "/my-convocation" }: { homeHref?: string }) {
  return <nav className="dashboard-mobile-nav" aria-label="Mobile dashboard navigation">{items.map(([label, href, Icon]) => <Link key={label} href={label === "Home" ? homeHref : href} aria-current={label === "Home" ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}</nav>;
}
