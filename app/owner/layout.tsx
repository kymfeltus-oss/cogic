import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Owner | COGIC LIVE",
  robots: { index: false, follow: false },
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
