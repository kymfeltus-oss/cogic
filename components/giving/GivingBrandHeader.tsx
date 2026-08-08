import Image from "next/image";
import { COGIC_GIVING_PUBLIC_NAME } from "@/lib/brand/public-display";
import { COGIC_GIVING_SEAL_SRC, COGIC_GIVING_TAGLINE } from "@/lib/giving/brand";

export default function GivingBrandHeader() {
  const [cogic, giving = "Giving"] = COGIC_GIVING_PUBLIC_NAME.split(" ");

  return (
    <header className="cogic-giving-brand">
      <span className="cogic-giving-brand__wave cogic-giving-brand__wave--magenta" aria-hidden="true" />
      <span className="cogic-giving-brand__wave cogic-giving-brand__wave--blue" aria-hidden="true" />
      <span className="cogic-giving-brand__seal-art" aria-hidden="true" />
      <div className="cogic-giving-brand__content">
        <Image
          src={COGIC_GIVING_SEAL_SRC}
          alt="Church of God in Christ seal"
          width={300}
          height={200}
          className="cogic-giving-seal"
          priority
        />
        <h1 className="cogic-giving-title">
          <span className="cogic-giving-title__cogic">{cogic}</span>
          <span className="cogic-giving-title__giving">{giving}</span>
        </h1>
        <p className="cogic-giving-tagline">{COGIC_GIVING_TAGLINE}</p>
        <p className="cogic-giving-hero-copy">Your generosity fuels ministries, supports communities, and expands the mission of the Church of God in Christ across the world.</p>
      </div>
    </header>
  );
}
