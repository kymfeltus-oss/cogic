"use client";

import { FormEvent, useState } from "react";
import { TravelFormSkeleton } from "@/components/travel/TravelLoadingSkeleton";

type UiState = "idle" | "loading" | "success" | "error";

type FormDataState = {
  party_size: number;
  travel_type: "multi" | "flight" | "hotel" | "car";
  destination: string;
  departure_date: string;
  return_date: string;
  notes: string;
};

export type GroupBookingRequestClientProps = {
  initialPartySize?: number;
  churchName: string;
  onCancel: () => void;
  onSubmitted?: () => void | Promise<void>;
};

/**
 * Pastor/Overseer form for corporate group quote requests (party_size >= 10).
 * church_id / requester_id / status are stamped by the API — never sent from the client.
 */
export function GroupBookingRequestClient({
  initialPartySize = 10,
  churchName,
  onCancel,
  onSubmitted,
}: GroupBookingRequestClientProps) {
  const [formData, setFormData] = useState<FormDataState>({
    party_size: Math.max(10, Math.floor(initialPartySize) || 10),
    travel_type: "multi",
    destination: "",
    departure_date: "",
    return_date: "",
    notes: "",
  });
  const [uiState, setUiState] = useState<UiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUiState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/travel/group-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_size: formData.party_size,
          travel_type: formData.travel_type,
          destination: formData.destination,
          departure_date: formData.departure_date,
          return_date: formData.return_date,
          notes: formData.notes,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Submission was rejected.");
      }

      setUiState("success");
      if (onSubmitted) {
        await onSubmitted();
      }
    } catch (err) {
      setUiState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to submit group booking request.",
      );
    }
  }

  if (uiState === "success") {
    return (
      <div className="rounded-xl border border-[#d8ab2e]/40 bg-[#d8ab2e]/10 p-6 text-center">
        <h3 className="text-xl font-bold text-white">Request logged for {churchName}</h3>
        <p className="mt-2 text-sm text-white/70">
          Your group quote request is pending review. Status updates appear in this list when
          operations changes them.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-black"
        >
          Back to requests
        </button>
      </div>
    );
  }

  if (uiState === "loading") {
    return <TravelFormSkeleton />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-white/15 bg-black/30 p-6"
    >
      <div className="border-b border-white/10 pb-3">
        <h2 className="text-lg font-bold text-white">Group booking request (10+ travelers)</h2>
        <p className="text-xs text-white/55">Submitting for {churchName}.</p>
      </div>

      {uiState === "error" ? (
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-xs text-red-100">
          {errorMessage || "Submission failed. Try again or contact travel support."}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-white/80">
          Total group size
          <input
            type="number"
            min={10}
            step={1}
            required
            value={formData.party_size}
            onChange={(event) =>
              setFormData({
                ...formData,
                party_size: Math.max(10, parseInt(event.target.value, 10) || 10),
              })
            }
            className="min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-white/80">
          Travel type
          <select
            value={formData.travel_type}
            onChange={(event) =>
              setFormData({
                ...formData,
                travel_type: event.target.value as FormDataState["travel_type"],
              })
            }
            className="min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
          >
            <option value="multi">Flights &amp; lodging</option>
            <option value="flight">Air only</option>
            <option value="hotel">Lodging only</option>
            <option value="car">Ground / car only</option>
          </select>
        </label>
      </div>

      <label className="grid gap-1 text-xs font-medium text-white/80">
        Destination / airport
        <input
          type="text"
          required
          maxLength={200}
          placeholder="e.g. St. Louis Convocation"
          value={formData.destination}
          onChange={(event) => setFormData({ ...formData, destination: event.target.value })}
          className="min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-white/80">
          Departure
          <input
            type="date"
            required
            value={formData.departure_date}
            onChange={(event) =>
              setFormData({ ...formData, departure_date: event.target.value })
            }
            className="min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-white/80">
          Return
          <input
            type="date"
            required
            value={formData.return_date}
            onChange={(event) => setFormData({ ...formData, return_date: event.target.value })}
            className="min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
          />
        </label>
      </div>

      <label className="grid gap-1 text-xs font-medium text-white/80">
        Notes / billing references (optional)
        <textarea
          rows={3}
          maxLength={2000}
          value={formData.notes}
          onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
          placeholder="Multi-church coordinates, accessibility, or baggage needs…"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
        />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl border border-white/20 px-4 text-xs font-semibold text-white/85 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-white px-4 text-xs font-semibold text-black"
        >
          Submit group request
        </button>
      </div>
    </form>
  );
}
