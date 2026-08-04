import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import TeamLoginClient from "@/components/auth/TeamLoginClient";
import { resolveTeamDestination } from "@/lib/auth/routing";

type TeamGatePageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

function TeamGateContent({
  nextPath,
  authError,
}: {
  nextPath: string;
  authError?: string;
}) {
  return <TeamLoginClient nextPath={nextPath} authError={authError ?? null} />;
}

export default async function TeamGatePage({ searchParams }: TeamGatePageProps) {
  const params = await searchParams;
  const nextPath = resolveTeamDestination(params.next);

  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh w-full items-center justify-center bg-brand-black text-brand-muted">
          <Loader2 className="h-5 w-5 animate-spin text-brand-pink" aria-hidden="true" />
        </main>
      }
    >
      <main
        id="main-content"
        className="min-h-dvh w-full bg-brand-black"
        aria-label="Team login"
      >
        <TeamGateContent nextPath={nextPath} authError={params.error} />
      </main>
    </Suspense>
  );
}
