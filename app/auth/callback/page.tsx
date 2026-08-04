import { Suspense } from "react";
import AuthCallbackClient from "@/components/auth/AuthCallbackClient";
import LightweightLiveLoading from "@/components/live/LightweightLiveLoading";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LightweightLiveLoading />}>
      <AuthCallbackClient />
    </Suspense>
  );
}
