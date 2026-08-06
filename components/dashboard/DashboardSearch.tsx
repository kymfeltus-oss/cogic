"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

const destinations = [
  { label: "Watch Live", description: "Open the full COGIC LIVE experience", href: "/live", terms: "broadcast stream lobby service" },
  { label: "Schedule", description: "View the published Convocation program", href: "/program", terms: "program events today sessions" },
  { label: "Giving", description: "Open secure COGIC Giving", href: "/giving", terms: "give donation offering" },
  { label: "My Convocation", description: "Registration and attendee details", href: "/my-convocation", terms: "registration credential attendee" },
  { label: "My Sanctuary", description: "Open your personal sanctuary", href: "/my-sanctuary", terms: "favorites personal prayer" },
  { label: "Replays", description: "Watch published services again", href: "/replays", terms: "archive video sermons watch again" },
] as const;

export default function DashboardSearch() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalized) return [];
    return destinations.filter((item) =>
      `${item.label} ${item.description} ${item.terms}`.toLowerCase().includes(normalized),
    );
  }, [normalized]);

  return (
    <div className="cl-topbar__search-wrap">
      <label className="cl-topbar__search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search COGIC LIVE destinations</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search COGIC LIVE"
          autoComplete="off"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear dashboard search">
            <X aria-hidden="true" />
          </button>
        ) : null}
      </label>
      {normalized ? (
        <div className="cl-topbar__search-results" aria-label="Search results" aria-live="polite">
          {results.length ? results.map((item) => (
            <Link key={item.href} href={item.href}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </Link>
          )) : <p>No matching COGIC LIVE destination.</p>}
        </div>
      ) : null}
    </div>
  );
}
