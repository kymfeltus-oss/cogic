import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import { Suspense } from "react";
import CogicGivingExperience from "@/components/giving/CogicGivingExperience";
import { COGIC_GIVING_PUBLIC_NAME } from "@/lib/brand/public-display";
import "./giving.css";

const givingDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-giving-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${COGIC_GIVING_PUBLIC_NAME} | COGIC LIVE`,
  description: "Give securely to Church of God in Christ, Inc.",
};

export default function GivingPage() {
  return (
    <main id="main-content" className={`cogic-giving-page ${givingDisplay.variable}`}>
      <Suspense fallback={<div className="cogic-giving-shell" aria-busy="true" />}>
        <CogicGivingExperience />
      </Suspense>
    </main>
  );
}
