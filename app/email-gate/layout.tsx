import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entry Hub | COGIC LIVE",
  description: "Select your entry path — attendee experience or production team login.",
};

export default function EmailGateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
