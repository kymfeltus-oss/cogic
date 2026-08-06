import type { Metadata } from "next";

import CredentialPublicExperience, {
  CredentialPublicUnavailable,
} from "@/components/credentials/CredentialPublicExperience";
import { readCredentialSessionFromCookies } from "@/lib/credentials/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function CredentialCleanPage() {
  const session = await readCredentialSessionFromCookies();

  return (
    <main
      id="main-content"
      className="credential-public-page"
      data-credential-shell="public"
    >
      {session ? (
        <CredentialPublicExperience credential={session} />
      ) : (
        <CredentialPublicUnavailable />
      )}
    </main>
  );
}
