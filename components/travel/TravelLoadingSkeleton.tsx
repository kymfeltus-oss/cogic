"use client";

/** Shared structural bone for travel corporate loading layouts (Law 14). */
export function TravelBone({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={[
        "block animate-pulse rounded-lg bg-white/[0.08]",
        className,
      ].join(" ")}
    />
  );
}

export function TravelListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="border-b border-white/10 pb-3">
          <TravelBone className="h-4 w-[75%] max-w-md" />
          <TravelBone className="mt-2 h-3 w-[50%] max-w-xs" />
        </div>
      ))}
    </div>
  );
}

export function TravelTableSkeleton({
  columns = 6,
  rows = 4,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="mt-4 overflow-x-auto" aria-busy="true" aria-label="Loading table">
      <div className="w-full min-w-[56rem]">
        <div
          className="grid gap-3 border-b border-white/15 pb-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, index) => (
            <TravelBone key={`h-${index}`} className="h-3 w-16" />
          ))}
        </div>
        <div className="divide-y divide-white/10">
          {Array.from({ length: rows }, (_, row) => (
            <div
              key={row}
              className="grid gap-3 py-3"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }, (_, col) => (
                <TravelBone
                  key={`r-${row}-${col}`}
                  className={
                    col === columns - 1 ? "ml-auto h-10 w-full max-w-sm" : "h-4 w-full"
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TravelFormSkeleton() {
  return (
    <div
      className="space-y-4 rounded-xl border border-white/15 bg-black/30 p-6"
      aria-busy="true"
      aria-label="Submitting"
    >
      <TravelBone className="h-5 w-56" />
      <TravelBone className="h-3 w-40" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TravelBone className="h-11 w-full" />
        <TravelBone className="h-11 w-full" />
        <TravelBone className="h-11 w-full sm:col-span-2" />
        <TravelBone className="h-11 w-full" />
        <TravelBone className="h-11 w-full" />
      </div>
      <TravelBone className="h-20 w-full" />
      <div className="flex justify-end gap-2 pt-2">
        <TravelBone className="h-11 w-24" />
        <TravelBone className="h-11 w-36" />
      </div>
    </div>
  );
}
