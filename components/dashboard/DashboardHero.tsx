import Image from "next/image";

/** Official Convocation banner — fluid width, intrinsic 2172×724 ratio on every viewport. */
export default function DashboardHero() {
  return (
    <section className="cl-hero" aria-label="118th Holy Convocation">
      <Image
        src="/my-sanctuary/banner.png"
        alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
        width={2172}
        height={724}
        priority
        quality={90}
        sizes="(max-width: 480px) 100vw, (max-width: 720px) 100vw, (max-width: 1180px) 94vw, (max-width: 1600px) min(1388px, 92vw), 1600px"
        className="cl-hero__image"
        style={{ width: "100%", height: "auto", maxWidth: "100%" }}
      />
    </section>
  );
}
