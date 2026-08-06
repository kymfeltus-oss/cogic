import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function SanctuaryPreview() {
  return (
    <article className="cl-action-card cl-action-card--sanctuary">
      <div className="cl-action-card__icon">
        <Sparkles aria-hidden="true" />
      </div>
      <p className="cl-action-card__eyebrow">My Sanctuary</p>
      <h3 className="cl-action-card__title">Your Convocation home</h3>
      <p className="cl-action-card__body">
        Return to your personalized Holy Convocation experience.
      </p>
      <Link href="/my-sanctuary" className="cl-btn cl-btn--ghost cl-btn--block">
        Open Sanctuary
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
