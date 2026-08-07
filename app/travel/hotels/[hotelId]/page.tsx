import { notFound } from "next/navigation";
import { TravelShell } from "@/components/travel/TravelShell";
import { publishedHotel } from "@/lib/travel/repository";
import HotelAvailabilityClient from "@/components/travel/HotelAvailabilityClient";
import { getUserFromSession } from "@/lib/auth/session";
import { userHotelState } from "@/lib/travel/reservations";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{hotelId:string}>;searchParams:Promise<{checkIn?:string;checkOut?:string}>}){
 const[{hotelId},query]=await Promise.all([params,searchParams]),hotel=await publishedHotel(hotelId);if(!hotel)notFound();
 const user=await getUserFromSession(),state=user?.id?await userHotelState(user.id):null,staying=state?.reservations.find(r=>r.hotel_id===hotel.id&&r.reservation_status==="confirmed");
 return <TravelShell back><p className="mt-8 font-black tracking-[.18em] text-[#efc23e]">{hotel.cogic_designation==="BISHOPS"?"BISHOPS HOTEL":"OFFICIAL COGIC HOUSING"}</p><h1 className="mt-3 max-w-4xl text-5xl font-black">{hotel.name}</h1>
 {staying?<div className="mt-6 rounded-2xl border border-green-400/30 bg-green-400/10 p-5"><p className="font-black text-green-300">✓ YOU&apos;RE STAYING HERE</p><p className="mt-2 text-lg">Your reservation: {staying.check_in} – {staying.check_out}</p><a href="/my-convocation/travel" className="mt-3 inline-block underline">View Reservation</a><p className="mt-3 text-sm text-white/60">Need another room? View availability below.</p></div>:null}
 <div className="mt-5 flex flex-wrap gap-3">{hotel.minimum_nights?<span className="rounded-full bg-[#d54cff]/20 px-4 py-2 font-bold">{hotel.minimum_nights} NIGHT MINIMUM</span>:null}<span className="rounded-full bg-white/10 px-4 py-2">Latest COGIC Housing Availability</span></div><p className="mt-7 max-w-4xl text-lg leading-8 text-white/75">{hotel.description}</p>{hotel.amenities.length?<ul className="mt-6 grid gap-2 text-lg sm:grid-cols-2">{hotel.amenities.map(a=><li key={a}>✓ {a}</li>)}</ul>:null}<HotelAvailabilityClient hotel={hotel} initialCheckIn={query.checkIn||"2026-11-03"} initialCheckOut={query.checkOut||"2026-11-09"}/><section className="mt-10 rounded-3xl border border-[#e4b938]/30 bg-[#e4b938]/10 p-6"><h2 className="text-2xl font-bold">Need Housing Help?</h2><p className="mt-2 text-lg"><a className="underline" href="mailto:housing@cogic.org">housing@cogic.org</a> · <a className="underline" href="tel:+17138242079">(713) 824-2079</a></p></section></TravelShell>
}
