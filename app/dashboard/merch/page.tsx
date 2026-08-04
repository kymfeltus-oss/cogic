"use client";

import { useCallback, useState } from "react";
import MerchCheckoutModal from "@/components/merch/MerchCheckoutModal";
import MerchProductCard from "@/components/merch/MerchProductCard";
import { MERCH_PRODUCTS, type MerchProduct } from "@/lib/merch/catalog";
import { useMerchCheckout } from "@/lib/useMerchCheckout";

export default function MerchPage() {
  const [activeProduct, setActiveProduct] = useState<MerchProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { isSubmitting, errorMessage, startCheckout, clearError } = useMerchCheckout();

  const openProductModal = useCallback(
    (product: MerchProduct) => {
      setActiveProduct(product);
      setSelectedSize("");
      clearError();
      setIsModalOpen(true);
    },
    [clearError],
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSize("");
    clearError();
  }, [clearError]);

  const handleCheckout = useCallback(() => {
    if (!activeProduct) return;
    void startCheckout({ product: activeProduct, selectedSize });
  }, [activeProduct, selectedSize, startCheckout]);

  return (
    <main className="min-h-dvh w-full bg-[#0B090A] pt-safe pb-safe text-white">
      <div className="w-full px-4 py-6 md:px-6 lg:px-8">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#1E40AF]">
            Marketplace Engine
          </p>
          <h1 className="mt-2 text-xl font-bold uppercase tracking-widest md:text-2xl">
            Awakening Merch
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Official event night apparel, album pre-orders, and virtual access
            tickets — optimized for fast mobile checkout and desktop browsing.
          </p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-4 snap-y snap-proximity sm:gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {MERCH_PRODUCTS.map((product) => (
            <MerchProductCard
              key={product.id}
              product={product}
              onOpen={openProductModal}
            />
          ))}
        </div>
      </div>

      <MerchCheckoutModal
        product={activeProduct}
        isOpen={isModalOpen}
        selectedSize={selectedSize}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onClose={closeModal}
        onSelectSize={setSelectedSize}
        onCheckout={handleCheckout}
      />
    </main>
  );
}
