import Image from "next/image";

export default function MySanctuaryHero() {
  return (
    <section className="my-sanctuary-hero" aria-label="118th Holy Convocation">
      <Image
        src="/my-sanctuary/banner.png"
        alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
        width={2160}
        height={1280}
        priority
        quality={95}
        sizes="(max-width: 430px) calc(100vw - 1.75rem), 402px"
        style={{ width: "100%", height: "auto", maxWidth: "100%" }}
      />
    </section>
  );
}
