export default function RegistrationLoading() {
  return (
    <main id="main-content" className="registration-page" aria-busy="true" aria-label="Loading registration">
      <section className="registration-shell">
        <div className="h-3 w-44 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-9 w-3/4 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-4 w-28 animate-pulse rounded bg-white/10" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-white/10" />
          ))}
        </div>
      </section>
    </main>
  );
}
