import Link from "next/link";
import { ShoppingBag } from "lucide-react";

/**
 * Attendee merch storefront is not published for COGIC LIVE.
 * Do not render legacy Awakening demo catalog items.
 */
export default function MerchPage() {
  return (
    <main className="min-h-dvh w-full bg-[#0B090A] pt-safe pb-safe text-white">
      <div className="w-full px-4 py-6 md:px-6 lg:px-8">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#1E40AF]">
            Merchandise
          </p>
          <h1 className="mt-2 text-xl font-bold uppercase tracking-widest md:text-2xl">
            Store unavailable
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            No COGIC LIVE merchandise catalog is published. Demo or legacy products are not shown.
          </p>
        </header>

        <section
          className="mt-10 rounded-2xl border border-white/10 bg-[#111111]/80 p-8 text-center"
          aria-labelledby="merch-empty-heading"
        >
          <ShoppingBag className="mx-auto h-12 w-12 text-[#1E40AF]" strokeWidth={1.5} />
          <h2
            id="merch-empty-heading"
            className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-white"
          >
            No products available
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            When an official catalog is published, products will appear here with real Stripe
            checkout pricing.
          </p>
          <Link
            href="/my-convocation"
            className="touch-target mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-[#1E40AF]/50 bg-[#1E40AF]/10 px-6 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#1E40AF]"
          >
            Back to My Convocation
          </Link>
        </section>
      </div>
    </main>
  );
}
