import Image from "next/image";

export default function MySanctuaryHero() {
  return (
    <section className="my-sanctuary-hero" aria-label="118th Holy Convocation">
      <Image
        src="/my-sanctuary/banner.png"
        alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
        width={2172}
        height={724}
        priority
        quality={95}
        sizes="(max-width: 480px) 100vw, (max-width: 720px) calc(100vw - 28px), (max-width: 1180px) calc(100vw - 100px), min(1100px, calc(100vw - 320px))"
        style={{ width: "100%", height: "auto", maxWidth: "100%" }}
      />
    </section>
  );
}
