import Link from "next/link";

import { buildProgramQueryString } from "@/lib/program/filter-program";
import type { ProgramEmptyStateKind } from "@/lib/program/types";

type ProgramEmptyStateProps = {
  kind: ProgramEmptyStateKind;
  message: string;
  selectedDay: string | null;
};

export default function ProgramEmptyState({
  kind,
  message,
  selectedDay,
}: ProgramEmptyStateProps) {
  const showReset = kind === "no_filter_matches";

  return (
    <div className="convocation-program-empty" role="status">
      <p>{message}</p>
      {showReset ? (
        <Link
          href={`/program${buildProgramQueryString({ day: selectedDay ?? undefined })}`}
          className="convocation-program-btn"
        >
          Clear Filters
        </Link>
      ) : null}
    </div>
  );
}
