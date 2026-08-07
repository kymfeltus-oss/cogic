import AnnouncementsFeed from "@/components/updates/AnnouncementsFeed";

export const dynamic = "force-dynamic";

export default function UpdatesPage() {
  return (
    <main className="relative z-[1] min-h-dvh w-full bg-transparent pt-safe pb-safe text-white">
      <div className="w-full px-4 py-6 md:px-6 lg:px-8">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[var(--cogic-magenta,#C62A9B)]">
            Announcements
          </p>
          <h1 className="mt-2 text-xl font-bold uppercase tracking-widest md:text-2xl">
            Event Updates
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Official communications from COGIC LIVE staff and authorized leadership.
            Only published updates appear here.
          </p>
        </header>

        <section className="mt-6 w-full" aria-label="Published announcements">
          <AnnouncementsFeed />
        </section>
      </div>
    </main>
  );
}
