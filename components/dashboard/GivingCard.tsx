import Link from "next/link";
import { ArrowRight, HeartHandshake } from "lucide-react";

export default function GivingCard() {
  return (
    <article className="cl-action-card cl-action-card--giving">
      <div className="cl-action-card__icon">
        <HeartHandshake aria-hidden="true" />
      </div>
      <p className="cl-action-card__eyebrow">COGIC Giving</p>
      <h3 className="cl-action-card__title">Support the mission</h3>
      <p className="cl-action-card__body">
        Give securely to Church of God in Christ, Inc.
      </p>
      <Link href="/giving" className="cl-btn cl-btn--primary cl-btn--block">
        Give Now
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
