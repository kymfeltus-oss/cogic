import Link from "next/link";
import { ArrowRight, HandHeart } from "lucide-react";

export default function GivingCard() {
  return (
    <article className="cl-feature-card cl-feature-card--giving">
      <p className="cl-feature-card__eyebrow">COGIC Giving</p>
      <div className="cl-feature-card__giving-mark">
        <HandHeart aria-hidden="true" />
        <span><strong>COGIC</strong><b>GIVING</b></span>
      </div>
      <p className="cl-feature-card__body">Reaching souls.<br />Changing lives.</p>
      <Link href="/giving" className="cl-btn cl-btn--primary cl-btn--block">
        Make a Gift
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <Link href="/giving" className="cl-btn cl-btn--ghost cl-btn--block">Open Giving</Link>
    </article>
  );
}
