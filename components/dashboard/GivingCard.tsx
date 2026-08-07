import Link from "next/link";
import { ArrowRight, HandHeart } from "lucide-react";
import IconBadge from "@/components/brand/IconBadge";

export default function GivingCard() {
  return (
    <article className="cl-feature-card cl-feature-card--giving">
      <p className="cl-feature-card__eyebrow">COGIC Giving</p>
      <IconBadge icon={HandHeart} className="cl-feature-card__icon-badge" />
      <h3>Make a Gift</h3>
      <p className="cl-feature-card__body">
        Reaching souls.
        <br />
        Changing lives.
      </p>
      <Link href="/giving" className="cl-btn cl-btn--primary cl-btn--block">
        Make a Gift
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
