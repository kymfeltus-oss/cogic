"use client";

import { MAX_GIVING_NOTE_LENGTH } from "@/lib/giving/validation";

type GivingNoteFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function GivingNoteField({ value, onChange }: GivingNoteFieldProps) {
  return (
    <section className="cogic-giving-note" aria-labelledby="cogic-giving-note-label">
      <p id="cogic-giving-note-label" className="cogic-giving-label">
        Note (optional)
      </p>
      <label className="sr-only" htmlFor="cogic-giving-note-input">
        Optional giving note
      </label>
      <input
        id="cogic-giving-note-input"
        type="text"
        maxLength={MAX_GIVING_NOTE_LENGTH}
        placeholder="Add a short note..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
