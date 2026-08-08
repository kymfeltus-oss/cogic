import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, Montserrat, Oswald, Parisienne } from "next/font/google";
import RootLayoutShell from "@/components/RootLayoutShell";
import {
  COGIC_LIVE_PUBLIC_NAME,
  COGIC_STREAM_SITE_DESCRIPTION,
} from "@/lib/brand/public-display";
import "./globals.css";
import "./my-convocation/dashboard.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
  adjustFontFallback: true,
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
});

const montserrat = Montserrat({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const oswald = Oswald({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
});

const parisienne = Parisienne({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: COGIC_LIVE_PUBLIC_NAME,
  description: COGIC_STREAM_SITE_DESCRIPTION,
  applicationName: COGIC_LIVE_PUBLIC_NAME,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${montserrat.variable} ${inter.variable} ${oswald.variable} ${parisienne.variable}`}
    >
      <body className="font-body device-fit-page min-h-dvh bg-transparent text-[16px] text-white antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:border focus:border-brand-blue/50 focus:bg-brand-panel focus:px-4 focus:py-2 focus:font-ui focus:text-xs focus:font-bold focus:uppercase focus:tracking-[0.14em] focus:text-brand-blue"
        >
          Skip to main content
        </a>
        <RootLayoutShell>{children}</RootLayoutShell>
      </body>
    </html>
  );
}
