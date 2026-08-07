import Image from "next/image";

export default function DashboardHero() {
  return (
    <section className="cl-hero" aria-label="118th Holy Convocation">
      <Image
        src="/my-sanctuary/banner.png"
        alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
        width={1024}
        height={576}
        priority
        quality={90}
        sizes="(max-width: 720px) 100vw, (max-width: 1180px) 94vw, 1388px"
        className="cl-hero__image"
      />
    </section>
  );
}
