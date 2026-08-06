import Link from "next/link";

import RemindMeControl from "@/components/reminders/RemindMeControl";
import type { ProgramOccurrenceDTO } from "@/lib/program/types";

type ProgramOccurrenceCardProps = {
  occurrence: ProgramOccurrenceDTO;
  signedIn?: boolean;
};

export default function ProgramOccurrenceCard({
  occurrence,
  signedIn = false,
}: ProgramOccurrenceCardProps) {
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

        <div className="convocation-program-card-actions">
          {occurrence.watchLiveAction ? (
            <Link
              href={occurrence.watchLiveAction.href}
              className="convocation-program-btn convocation-program-btn-primary"
            >
              {occurrence.watchLiveAction.label}
            </Link>
          ) : null}
          <RemindMeControl
            occurrenceId={occurrence.occurrenceId}
            canRemind={occurrence.canRemind}
            signedIn={signedIn}
          />
        </div>
      </article>
    </li>
  );
}
