import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="responsive-page grid place-items-center bg-brand-black text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-[clamp(1.25rem,6vw,3rem)] text-center">
        <p className="font-ui text-sm font-semibold uppercase tracking-[0.14em] text-brand-blue">Page unavailable</p>
        <h1 className="mt-3 font-headline text-[clamp(2.5rem,10vw,5rem)] leading-none">We couldn&apos;t find that page</h1>
        <p className="mt-5 font-body text-base leading-7 text-white/75">The link may have changed, or the page may not be available yet.</p>
        <Link href="/" className="touch-target mt-8 inline-flex items-center justify-center rounded-full border border-brand-blue/50 bg-brand-blue/10 px-6 py-3 font-ui text-sm font-bold text-brand-blue">
          Return home
        </Link>
      </section>
    </main>
  );
}
