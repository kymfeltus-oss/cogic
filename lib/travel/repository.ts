import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY, type TravelHotel } from "./types";
export async function publishedHotels():Promise<TravelHotel[]>{
 const {data,error}=await getSupabaseAdmin().from("travel_hotels").select("*,travel_hotel_room_types(id,name,nightly_rate_cents,currency,travel_hotel_nightly_availability(stay_date,availability_status,nightly_rate_cents))").eq("program_key",TRAVEL_PROGRAM_KEY).eq("published",true).eq("archived",false).eq("travel_hotel_room_types.published",true).order("display_order");
 if(error){ console.error("Unable to load published travel hotels",error.message); return []; } return (data??[]) as TravelHotel[];
}
export async function publishedHotel(slug:string):Promise<TravelHotel|null>{const hotels=await publishedHotels();return hotels.find(h=>h.slug===slug||h.id===slug)??null;}
export async function publicTravelInfo(){const db=getSupabaseAdmin();const [airports,transport,announcements]=await Promise.all([db.from("travel_airports").select("*").eq("program_key",TRAVEL_PROGRAM_KEY).eq("published",true).order("display_order"),db.from("travel_transportation_options").select("*").eq("program_key",TRAVEL_PROGRAM_KEY).eq("published",true).order("display_order"),db.from("travel_announcements").select("*").eq("program_key",TRAVEL_PROGRAM_KEY).eq("published",true).order("published_at",{ascending:false})]);return {airports:airports.data??[],transport:transport.data??[],announcements:announcements.data??[]};}
