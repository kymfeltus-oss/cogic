"use client";

import { useCallback, useState } from "react";
import { getClientAppUrl } from "@/lib/client-api";
import type { MerchProduct } from "@/lib/merch/catalog";

type MerchCheckoutPayload = {
  product: MerchProduct;
  selectedSize: string;
};

type UseMerchCheckoutResult = {
  isSubmitting: boolean;
  errorMessage: string | null;
  startCheckout: (payload: MerchCheckoutPayload) => Promise<void>;
  clearError: () => void;
};

export function useMerchCheckout(): UseMerchCheckoutResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const startCheckout = useCallback(
    async ({ product, selectedSize }: MerchCheckoutPayload) => {
      if (product.requiresSize && !selectedSize) {
        setErrorMessage("Select a size to continue.");
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`${getClientAppUrl()}/api/checkout/merch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            productId: product.id,
            selectedSize: selectedSize || null,
          }),
        });

        const data = (await response.json()) as { url?: string; error?: string };

        if (response.status === 401) {
          setErrorMessage("Sign in at the email gate before checkout.");
          return;
        }

        if (!response.ok || !data.url) {
          setErrorMessage(data.error ?? "Unable to start checkout. Please try again.");
          return;
        }

        window.location.href = data.url;
      } catch {
        setErrorMessage("Unable to reach checkout. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    isSubmitting,
    errorMessage,
    startCheckout,
    clearError,
  };
}
