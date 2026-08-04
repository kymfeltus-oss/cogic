import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Experience | 300 Awakening",
  description: "Tap Into The Awakening — your premium attendee experience hub.",
};

export default function ExperienceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
