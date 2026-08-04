"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import {
  formatMerchPrice,
  MERCH_SIZES,
  type MerchProduct,
} from "@/lib/merch/catalog";

type MerchCheckoutModalProps = {
  product: MerchProduct | null;
  isOpen: boolean;
  selectedSize: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSelectSize: (size: string) => void;
  onCheckout: () => void;
};

export default function MerchCheckoutModal({
  product,
  isOpen,
  selectedSize,
  isSubmitting,
  errorMessage,
  onClose,
  onSelectSize,
  onCheckout,
}: MerchCheckoutModalProps) {
  const requiresSize = product?.requiresSize ?? false;
  const canCheckout = Boolean(product) && (!requiresSize || selectedSize);

  return (
    <AnimatePresence>
      {isOpen && product && (
        <>
          <motion.button
            type="button"
            aria-label="Close product checkout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="merch-checkout-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[90dvh] w-full max-w-lg -translate-y-1/2 overflow-y-auto rounded-3xl border border-[#1E40AF]/40 bg-zinc-900/95 p-6 shadow-[0_0_50px_rgba(30,64,175,0.25)] backdrop-blur-xl md:inset-x-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-[#1E40AF]">
                  {product.category}
                </p>
                <h2
                  id="merch-checkout-title"
                  className="mt-1 text-base font-bold uppercase tracking-widest text-white"
                >
                  {product.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full border border-white/15 p-2 text-zinc-400 transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
              <Image
                src={product.image}
                alt={product.title}
                fill
                unoptimized
                className="object-cover"
              />
            </div>

            <p className="mt-4 text-sm leading-relaxed text-zinc-400">{product.description}</p>
            <p className="mt-3 text-xl font-bold text-[#1E40AF]">
              {formatMerchPrice(product.price)}
            </p>

            {requiresSize && (
              <div className="mt-6">
                <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-zinc-400">
                  Select Size
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {MERCH_SIZES.map((size) => {
                    const isActive = selectedSize === size;

                    return (
                      <motion.button
                        key={size}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onSelectSize(size)}
                        className={`rounded-xl border py-3 text-xs font-bold uppercase transition ${
                          isActive
                            ? "border-[#B0267A] bg-[#B0267A]/10 text-white shadow-[0_0_18px_rgba(176,38,122,0.45)]"
                            : "border-white/15 bg-[#0B090A] text-white/80 hover:border-[#1E40AF]/60"
                        }`}
                      >
                        {size}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-[#B0267A]/40 bg-[#B0267A]/10 px-4 py-3 text-center text-sm text-zinc-200"
              >
                {errorMessage}
              </p>
            )}

            <motion.button
              type="button"
              whileTap={isSubmitting ? undefined : { scale: 0.98 }}
              onClick={onCheckout}
              disabled={!canCheckout || isSubmitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1E40AF] to-[#B0267A] px-6 py-5 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-[0_0_35px_rgba(176,38,122,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Preparing Checkout...</span>
                </>
              ) : (
                "Initialize Stripe Checkout"
              )}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
