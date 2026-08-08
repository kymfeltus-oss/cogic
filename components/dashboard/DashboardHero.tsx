import Image from "next/image";

/** Official Convocation banner, fluid across desktop, tablet, and mobile. */
export default function DashboardHero() {
  return (
    <section className="cl-hero" aria-label="118th Holy Convocation featuring Church Of God In Christ bishops">
      <Image
        src="/my-sanctuary/banner.png"
        alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
        width={1629}
        height={965}
        priority
        quality={90}
        sizes="(max-width: 720px) calc(100vw - 1.75rem), (max-width: 1180px) calc(100vw - 2rem), min(96vw, 1600px)"
        className="cl-hero__image"
      />
    </section>
  );
}
