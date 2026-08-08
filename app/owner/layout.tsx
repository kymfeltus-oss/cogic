import type { Metadata } from "next";
import "./owner.css";

export const metadata: Metadata = {
  title: "Owner | COGIC LIVE",
  robots: { index: false, follow: false },
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="owner-brand-shell relative z-[1] min-h-dvh text-white">{children}</div>;
}
