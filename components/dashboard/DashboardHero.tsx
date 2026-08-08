import Image from "next/image";

/** Official Convocation banner — desktop bishops art; mobile-optimized crop below 720px. */
export default function DashboardHero() {
  return (
    <section className="cl-hero" aria-label="118th Holy Convocation featuring Church Of God In Christ bishops">
      <picture>
        <source media="(max-width: 720px)" srcSet="/my-sanctuary/mobile-banner-bishops.png" />
        <Image
          src="/my-sanctuary/convocation-banner-bishops-v2.png"
          alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
          width={1827}
          height={861}
          priority
          quality={90}
          sizes="(max-width: 720px) 100vw, (max-width: 1180px) 94vw, 1388px"
          className="cl-hero__image"
          style={{ width: "100%", height: "auto", maxWidth: "100%" }}
        />
      </picture>
    </section>
  );
}
