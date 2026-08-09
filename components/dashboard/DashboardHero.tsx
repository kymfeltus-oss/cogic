import Image from "next/image";

/** Official Convocation banner within the mobile-only attendee shell. */
export default function DashboardHero() {
  return (
    <section className="cl-hero" aria-label="118th Holy Convocation featuring Church Of God In Christ bishops">
      <Image
        src="/my-sanctuary/banner.png"
        alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
        width={2160}
        height={1280}
        priority
        quality={90}
        sizes="(max-width: 430px) calc(100vw - 1.75rem), 402px"
        className="cl-hero__image"
      />
    </section>
  );
}
