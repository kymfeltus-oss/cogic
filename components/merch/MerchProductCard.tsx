"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { formatMerchPrice, type MerchProduct } from "@/lib/merch/catalog";

type MerchProductCardProps = {
  product: MerchProduct;
  onOpen: (product: MerchProduct) => void;
};

export default function MerchProductCard({ product, onOpen }: MerchProductCardProps) {
  return (
    <motion.article
      layout
      className="group relative flex snap-start flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111]/90 shadow-[0_0_24px_rgba(30,64,175,0.08)] transition hover:border-[#1E40AF]/40"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-black">
        <Image
          src={product.image}
          alt={product.title}
          fill
          unoptimized
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B090A] via-transparent to-transparent" />

        {product.badge && (
          <span className="absolute top-3 left-3 rounded-full border border-[#B0267A]/50 bg-[#B0267A]/20 px-3 py-1 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-white">
            {product.badge}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-[#1E40AF]">
            {product.category}
          </p>
          <h2 className="mt-1 text-sm font-bold uppercase tracking-[0.1em] text-white">
            {product.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{product.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <p className="text-base font-bold text-[#1E40AF]">{formatMerchPrice(product.price)}</p>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => onOpen(product)}
          className="rounded-xl border border-[#B0267A]/50 bg-[#B0267A]/10 px-4 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white transition hover:border-[#B0267A] hover:shadow-[0_0_18px_rgba(176,38,122,0.35)]"
        >
          View & Buy
        </motion.button>
      </div>
    </motion.article>
  );
}
