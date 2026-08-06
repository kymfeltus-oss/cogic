"use client";

import { useState } from "react";
import { getClientAppUrl } from "@/lib/client-api";

type RegistrationCheckoutButtonProps = {
  label: string;
  className?: string;
};

export default function RegistrationCheckoutButton({
  label,
  className = "registration-btn registration-btn-primary",
}: RegistrationCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getClientAppUrl()}/api/registration/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (response.status === 401) {
        setError("Sign in to continue to payment.");
        return;
      }

      if (!response.ok || !data.url) {
        setError(data.error || "Unable to start checkout. Please try again.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="registration-checkout-actions">
      <button
        type="button"
        className={className}
        onClick={() => void startCheckout()}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? "Starting checkout…" : label}
      </button>
      {error ? (
        <p className="registration-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
