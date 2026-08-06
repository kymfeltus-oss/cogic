import type { ProgramOccurrenceDTO } from "@/lib/program/types";

import ProgramOccurrenceCard from "./ProgramOccurrenceCard";

type ProgramDaySectionProps = {
  heading: string;
  occurrences: ProgramOccurrenceDTO[];
  signedIn?: boolean;
};

export default function ProgramDaySection({
  heading,
  occurrences,
  signedIn = false,
}: ProgramDaySectionProps) {
  return (
    <section className="convocation-program-day-section" aria-labelledby="program-day-heading">
      <h2 id="program-day-heading" className="convocation-program-day-heading">
        {heading}
      </h2>
      <ul className="convocation-program-list">
        {occurrences.map((occurrence) => (
          <ProgramOccurrenceCard
            key={occurrence.occurrenceKey}
            occurrence={occurrence}
            signedIn={signedIn}
          />
        ))}
      </ul>
    </section>
  );
}
