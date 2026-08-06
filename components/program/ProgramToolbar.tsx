"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { buildProgramQueryString } from "@/lib/program/filter-program";
import type { ProgramCategoryFilter, ProgramCategoryId } from "@/lib/program/types";

type ProgramToolbarProps = {
  selectedDay: string | null;
  activeCategory: ProgramCategoryId;
  searchQuery: string;
  availableCategories: ProgramCategoryFilter[];
  resultCount: number;
};

export default function ProgramToolbar({
  selectedDay,
  activeCategory,
  searchQuery,
  availableCategories,
  resultCount,
}: ProgramToolbarProps) {
  const router = useRouter();
  const searchId = useId();
  const filterId = useId();
  const [draftSearch, setDraftSearch] = useState(searchQuery);

  useEffect(() => {
    setDraftSearch(searchQuery);
  }, [searchQuery]);

  function navigate(next: {
    category?: ProgramCategoryId;
    searchQuery?: string;
  }) {
    router.push(
      `/program${buildProgramQueryString({
        day: selectedDay ?? undefined,
        category: next.category ?? activeCategory,
        searchQuery: next.searchQuery ?? draftSearch,
      })}`,
    );
  }

  return (
    <div className="convocation-program-toolbar">
      <form
        className="convocation-program-search-row"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ searchQuery: draftSearch });
        }}
      >
        <div style={{ flex: "1 1 16rem" }}>
          <label htmlFor={searchId} className="convocation-program-search-label">
            Search schedule
          </label>
          <input
            id={searchId}
            name="q"
            type="search"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            className="convocation-program-search-input"
            placeholder="Search title, venue, or category"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="convocation-program-btn convocation-program-btn-primary">
          Search
        </button>
      </form>

      <div>
        <label htmlFor={filterId} className="convocation-program-filter-label">
          Filter by category
        </label>
        <select
          id={filterId}
          name="category"
          value={activeCategory}
          onChange={(event) =>
            navigate({ category: event.target.value as ProgramCategoryId })
          }
          className="convocation-program-filter-select"
        >
          {availableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <p className="convocation-program-result-count" aria-live="polite">
        {resultCount} event{resultCount === 1 ? "" : "s"} shown
      </p>
    </div>
  );
}
