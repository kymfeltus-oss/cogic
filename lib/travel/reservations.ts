import "server-only";import{getSupabaseAdmin}from"@/lib/supabase/server";import{TRAVEL_PROGRAM_KEY}from"./types";
export type HotelReservationSummary={id:string;hotel_id:string|null;hotel_name_snapshot:string;room_type:string;check_in:string;check_out:string;confirmation_number:string|null;guest_count:number|null;nightly_rate_cents:number|null;notes:string|null;reservation_status:"awaiting_confirmation"|"confirmed"|"canceled";primary_stay:boolean;booking_source:string;confirmed_at:string|null};
export async function userHotelState(userId:string){const db=getSupabaseAdmin();const[{data:reservations},{data:journey}]=await Promise.all([db.from("travel_hotel_reservations").select("*").eq("program_key",TRAVEL_PROGRAM_KEY).eq("user_id",userId).order("primary_stay",{ascending:false}).order("created_at",{ascending:false}),db.from("travel_hotel_booking_journeys").select("*,travel_hotels(name,slug),travel_hotel_room_types(name)").eq("program_key",TRAVEL_PROGRAM_KEY).eq("user_id",userId).in("reservation_status",["booking_started","awaiting_confirmation"]).order("booking_started_at",{ascending:false}).limit(1).maybeSingle()]);const rows=((reservations??[]) as HotelReservationSummary[]).map((row)=>({
  ...row,
  confirmation_number: row.confirmation_number ? maskConfirmation(row.confirmation_number) : null,
}));
return{
  reservations:rows,
  primary:rows.find(r=>r.primary_stay&&r.reservation_status==="confirmed")??rows.find(r=>r.reservation_status==="confirmed")??null,
  journey:journey??null,
};}
export function maskConfirmation(value:string|null){if(!value)return"Not provided";const last=value.slice(-4);return`••••${last}`;}
