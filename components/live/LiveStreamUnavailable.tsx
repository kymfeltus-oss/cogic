import Link from "next/link";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

type LiveStreamUnavailableProps = {
  title?: string;
  message: string;
  showLiveLink?: boolean;
};

export default function LiveStreamUnavailable({
  title = "Broadcast unavailable",
  message,
  showLiveLink = true,
}: LiveStreamUnavailableProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-6 text-white">
      <div className="max-w-md text-center">
        <p className="font-ui text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white/55">
          Live
        </p>
        <h1 className="mt-3 font-headline text-2xl uppercase tracking-[0.08em]">{title}</h1>
        <p className="mt-4 font-body text-base text-white/75">{message}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          {showLiveLink ? (
            <Link
              href="/live"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-blue/50 bg-brand-blue/10 px-6 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-brand-blue"
            >
              Check Live Status
            </Link>
          ) : null}
          <Link
            href={ATTENDEE_DASHBOARD_PATH}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white"
          >
            Back Home
          </Link>
        </div>
      </div>
    </main>
  );
}
