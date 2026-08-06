import Link from "next/link";

import { formatConvocationDate } from "@/lib/my-convocation/schedule";
import { buildProgramQueryString } from "@/lib/program/filter-program";
import type { ProgramCategoryId } from "@/lib/program/types";

type ProgramDayNavigationProps = {
  publishedDayDates: string[];
  selectedDay: string | null;
  activeCategory: ProgramCategoryId;
  searchQuery: string;
};

export default function ProgramDayNavigation({
  publishedDayDates,
  selectedDay,
  activeCategory,
  searchQuery,
}: ProgramDayNavigationProps) {
  if (publishedDayDates.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Program days">
      <div className="convocation-program-day-nav">
        {publishedDayDates.map((day) => (
          <Link
            key={day}
            href={`/program${buildProgramQueryString({
              day,
              category: activeCategory,
              searchQuery,
            })}`}
            className="convocation-program-day-link"
            aria-current={day === selectedDay ? "true" : undefined}
          >
            {formatConvocationDate(day)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
