import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function ConvocationHero() {
  return (
    <section className="convocation-hero" aria-label="118th Holy Convocation">
      <div className="convocation-hero__artwork">
        <Image
          src="/my-sanctuary/banner.png"
          alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
          width={1024}
          height={576}
          priority
          quality={95}
          sizes="(max-width: 720px) calc(100vw - 28px), (max-width: 1180px) calc(100vw - 100px), min(1100px, calc(100vw - 320px))"
        />
      </div>
      <div className="convocation-hero__actions">
        <Link href="/program" className="convocation-hero__link">
          Explore the program <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
