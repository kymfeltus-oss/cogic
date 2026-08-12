/** Browser Stripe publishable key — never a secret. */
export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key || key.includes("yourActual") || key.includes("pk_test_replace")) {
    return null;
  }
  return key;
}
