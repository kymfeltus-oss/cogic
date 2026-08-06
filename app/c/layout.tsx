import type { Metadata, Viewport } from "next";

import { credentialSecurityHeaderRecord } from "@/lib/credentials/security-headers";

import "./credential-public.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function headers() {
  return Object.entries(credentialSecurityHeaderRecord()).map(([key, value]) => ({
    key,
    value,
  }));
}

export const metadata: Metadata = {
  title: "Convocation Credential | COGIC Stream",
  description: "Secure Convocation credential access",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function CredentialPublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="credential-public-shell" data-credential-shell="isolated">
      {children}
    </div>
  );
}
