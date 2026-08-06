"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";

type GivingSubmitButtonProps = {
  disabled: boolean;
  loading: boolean;
};

export default function GivingSubmitButton({
  disabled,
  loading,
}: GivingSubmitButtonProps) {
  return (
    <button
      type="submit"
      className="cogic-giving-submit touch-target"
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          Processing...
        </>
      ) : (
        <>
          Give Now
          <ArrowRight className="cogic-giving-submit__arrow size-5" aria-hidden="true" />
        </>
      )}
    </button>
  );
}
