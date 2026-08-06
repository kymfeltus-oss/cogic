import Link from "next/link";

import type { ProgramOccurrenceDTO } from "@/lib/program/types";

type ProgramOccurrenceCardProps = {
  occurrence: ProgramOccurrenceDTO;
};

export default function ProgramOccurrenceCard({ occurrence }: ProgramOccurrenceCardProps) {
  return (
    <li className="convocation-program-card">
      <article aria-labelledby={`program-event-${occurrence.occurrenceKey}`}>
        <div className="convocation-program-card-header">
          <p className="convocation-program-card-time">{occurrence.timePrimary}</p>
          <p
            className="convocation-program-card-status"
            data-live={occurrence.isLiveNow ? "true" : "false"}
          >
            {occurrence.statusLabel}
          </p>
        </div>

        <h3 id={`program-event-${occurrence.occurrenceKey}`} className="convocation-program-card-title">
          {occurrence.title}
        </h3>

        <p className="convocation-program-card-meta">
          {occurrence.categoryLabel}
          {occurrence.venueLabel ? ` · ${occurrence.venueLabel}` : ""}
        </p>

        {occurrence.timeSecondary ? (
          <p className="convocation-program-card-meta">{occurrence.timeSecondary}</p>
        ) : null}

        {occurrence.endTimeLabel ? (
          <p className="convocation-program-card-meta">Ends {occurrence.endTimeLabel}</p>
        ) : null}

        {occurrence.description ? (
          <p className="convocation-program-card-description">{occurrence.description}</p>
        ) : null}

        {occurrence.watchLiveAction ? (
          <div className="convocation-program-card-actions">
            <Link
              href={occurrence.watchLiveAction.href}
              className="convocation-program-btn convocation-program-btn-primary"
            >
              {occurrence.watchLiveAction.label}
            </Link>
          </div>
        ) : null}
      </article>
    </li>
  );
}
