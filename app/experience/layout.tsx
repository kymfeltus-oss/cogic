import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Experience | COGIC LIVE",
  description: "Your COGIC LIVE Convocation experience hub.",
};

export default function ExperienceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
