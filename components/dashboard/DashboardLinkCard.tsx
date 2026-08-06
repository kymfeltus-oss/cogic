import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function DashboardLinkCard({
  eyebrow,
  title,
  body,
  href,
  action,
  secondaryAction = "Browse all",
  icon: Icon,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  action: string;
  secondaryAction?: string;
  icon: LucideIcon;
  tone?: "default" | "gold";
}) {
  return (
    <article className={`cl-feature-card cl-feature-card--${tone}`}>
      <p className="cl-feature-card__eyebrow">{eyebrow}</p>
      <div className="cl-feature-card__icon"><Icon aria-hidden="true" /></div>
      <h3>{title}</h3>
      <p className="cl-feature-card__body">{body}</p>
      <Link href={href} className="cl-btn cl-btn--primary cl-btn--block">
        {action}<ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <Link href={href} className="cl-btn cl-btn--ghost cl-btn--block">{secondaryAction}</Link>
    </article>
  );
}
