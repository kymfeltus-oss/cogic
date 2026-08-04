import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Owner | Vital Organs Entertainment",
  robots: { index: false, follow: false },
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
