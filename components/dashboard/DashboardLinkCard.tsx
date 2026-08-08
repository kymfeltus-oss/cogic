import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import IconBadge from "@/components/brand/IconBadge";

export default function DashboardLinkCard({
  eyebrow,
  title,
  body,
  href,
  action,
  icon: Icon,
  tone = "default",
  tier = "feature",
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  action: string;
  icon: LucideIcon;
  tone?: "default" | "gold";
  tier?: "primary" | "feature" | "info";
}) {
  const tierClass =
    tier === "primary"
      ? "cl-card--tier-1"
      : tier === "info"
        ? "cl-card--tier-3"
        : "cl-card--tier-2";

  return (
    <article className={`cl-card ${tierClass} cl-feature-card cl-feature-card--${tone}`}>
      <p className="cl-feature-card__eyebrow">{eyebrow}</p>
      <IconBadge icon={Icon} className="cl-feature-card__icon-badge" />
      <h3>{title}</h3>
      <p className="cl-feature-card__body">{body}</p>
      <Link href={href} className="cl-btn cl-btn--primary cl-btn--block">
        {action}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
