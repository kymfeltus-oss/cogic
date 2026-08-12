import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import {
  TRAVEL_GROUP_REQUEST_STATUSES,
  type SanitizedTravelGroupCreateFields,
  type TravelGroupRequestStatus,
  type TravelGroupTravelType,
} from "@/lib/travel/group-booking/validation";

export {
  TRAVEL_GROUP_MIN_PARTY_SIZE,
  TRAVEL_GROUP_REQUEST_STATUSES,
  TRAVEL_GROUP_TRAVEL_TYPES,
  isTravelGroupRequestValidationError,
  sanitizeTravelGroupRequestCreateInput,
  type SanitizedTravelGroupCreateFields,
  type TravelGroupRequestStatus,
  type TravelGroupRequestValidationError,
  type TravelGroupTravelType,
} from "@/lib/travel/group-booking/validation";

export type TravelGroupBookingRequestRow = {
  id: string;
  program_key: string;
  church_id: string;
  requester_id: string;
  party_size: number;
  travel_type: TravelGroupTravelType;
  destination: string;
  departure_date: string;
  return_date: string;
  internal_notes: string | null;
  status: TravelGroupRequestStatus;
  owner_notes: string | null;
  allocated_quote_cents: number | null;
  created_at: string;
  updated_at: string;
};

export type CreateTravelGroupRequestInput = SanitizedTravelGroupCreateFields & {
  churchId: string;
  requesterId: string;
};

export async function listTravelGroupRequestsForChurch(
  churchId: string,
): Promise<TravelGroupBookingRequestRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("travel_group_booking_requests")
    .select("*")
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .eq("church_id", churchId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as TravelGroupBookingRequestRow[];
}

export async function createTravelGroupRequest(
  input: CreateTravelGroupRequestInput,
): Promise<TravelGroupBookingRequestRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("travel_group_booking_requests")
    .insert({
      program_key: TRAVEL_PROGRAM_KEY,
      church_id: input.churchId,
      requester_id: input.requesterId,
      party_size: input.partySize,
      travel_type: input.travelType,
      destination: input.destination,
      departure_date: input.departureDate,
      return_date: input.returnDate,
      internal_notes: input.internalNotes,
      status: "pending_quote",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create group booking request.");
  }

  return data as TravelGroupBookingRequestRow;
}

export async function listAllTravelGroupRequests(
  limit = 100,
): Promise<TravelGroupBookingRequestRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 250));
  const { data, error } = await getSupabaseAdmin()
    .from("travel_group_booking_requests")
    .select("*")
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw error;
  }

  return (data ?? []) as TravelGroupBookingRequestRow[];
}

export async function getTravelGroupRequestById(
  requestId: string,
): Promise<TravelGroupBookingRequestRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("travel_group_booking_requests")
    .select("*")
    .eq("id", requestId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as TravelGroupBookingRequestRow | null) ?? null;
}

function isRequestStatus(value: string): value is TravelGroupRequestStatus {
  return (TRAVEL_GROUP_REQUEST_STATUSES as readonly string[]).includes(value);
}

export async function updateTravelGroupRequestStatus(input: {
  requestId: string;
  status: TravelGroupRequestStatus;
  ownerNotes: string | null;
  allocatedQuoteCents?: number | null;
}): Promise<TravelGroupBookingRequestRow> {
  if (!isRequestStatus(input.status)) {
    throw new Error("Invalid group request status.");
  }

  const patch: Record<string, unknown> = {
    status: input.status,
    owner_notes: input.ownerNotes,
  };
  if (input.allocatedQuoteCents !== undefined) {
    patch.allocated_quote_cents = input.allocatedQuoteCents;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("travel_group_booking_requests")
    .update(patch)
    .eq("id", input.requestId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to update group booking request.");
  }

  return data as TravelGroupBookingRequestRow;
}
