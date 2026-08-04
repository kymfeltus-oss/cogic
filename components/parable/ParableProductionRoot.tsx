"use client";

import { JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "@/styles/parable-production.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

type ParableProductionRootProps = {
  children: ReactNode;
  className?: string;
};

export default function ParableProductionRoot({
  children,
  className = "",
}: ParableProductionRootProps) {
  return (
    <div
      className={`parable-production min-h-dvh antialiased ${jetbrainsMono.variable} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
