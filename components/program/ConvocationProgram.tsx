import { COGIC_LIVE_PUBLIC_NAME } from "@/lib/brand/public-display";
import type { ProgramViewState } from "@/lib/program/types";

import ProgramDayNavigation from "./ProgramDayNavigation";
import ProgramDaySection from "./ProgramDaySection";
import ProgramEmptyState from "./ProgramEmptyState";
import ProgramToolbar from "./ProgramToolbar";

type ConvocationProgramProps = {
  view: ProgramViewState;
  signedIn?: boolean;
};

export default function ConvocationProgram({
  view,
  signedIn = false,
}: ConvocationProgramProps) {
  return (
    <div className="convocation-program-shell">
      <div className="convocation-program-layout">
        <header className="convocation-program-header">
          <p className="convocation-program-kicker">{COGIC_LIVE_PUBLIC_NAME}</p>
          <h1 className="convocation-program-title">118th Holy Convocation Digital Program</h1>
          <p className="convocation-program-lede">
            Official published schedule for the 118th Holy Convocation. Times are shown in Central
            Time unless noted.
          </p>
        </header>

        {view.publishedDayDates.length > 0 ? (
          <>
            <ProgramDayNavigation
              publishedDayDates={view.publishedDayDates}
              selectedDay={view.selectedDay}
              activeCategory={view.activeCategory}
              searchQuery={view.searchQuery}
            />
            <ProgramToolbar
              selectedDay={view.selectedDay}
              activeCategory={view.activeCategory}
              searchQuery={view.searchQuery}
              availableCategories={view.availableCategories}
              resultCount={view.resultCount}
            />
          </>
        ) : null}

        {view.emptyState ? (
          <ProgramEmptyState
            kind={view.emptyState}
            message={view.emptyMessage}
            selectedDay={view.selectedDay}
          />
        ) : view.selectedDayHeading ? (
          <ProgramDaySection
            heading={view.selectedDayHeading}
            occurrences={view.occurrences}
            signedIn={signedIn}
          />
        ) : null}
      </div>
    </div>
  );
}
