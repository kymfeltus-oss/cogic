import Link from "next/link";
import { ArrowLeft, BedDouble, Car, Plane, MapPinned, BriefcaseBusiness } from "lucide-react";
export function TravelShell({children,back}:{children:React.ReactNode;back?:boolean}){return <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#17114a_0,#070713_48%,#020205_100%)] px-5 py-8 text-white"><div className="mx-auto max-w-6xl">{back?<Link className="inline-flex min-h-12 items-center gap-2 text-lg text-white/80" href="/travel"><ArrowLeft/> Back to COGIC Travel</Link>:null}{children}</div></main>}
export const travelLinks=[{href:"/travel/hotels",label:"Hotels",icon:BedDouble},{href:"/travel/flights",label:"Flights",icon:Plane},{href:"/travel/cars",label:"Rental Cars",icon:Car},{href:"/travel/getting-around",label:"Getting Around",icon:MapPinned},{href:"/travel",label:"COGIC Travel Hub",icon:BriefcaseBusiness}];
export function HonestUnavailable({kind,embedded}:{kind:string;embedded?:boolean}){
  const title=kind==="flight"
    ?"US flight marketplace is not connected yet."
    :kind==="rental car"
      ?"US rental-car marketplace is not connected yet."
      :`Live ${kind} marketplace is not connected yet.`;
  return <div className="ct-unavailable-panel mt-7 rounded-3xl border border-amber-300/30 bg-amber-200/10 p-6">
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="mt-2 max-w-2xl text-lg leading-8 text-white/75">Configure Expedia Rapid and/or Duffel (or Enterprise Amadeus) on the server to enable live US inventory. We will never show invented prices or availability.{embedded?null:" Official COGIC rates remain available, and you can save reservations made elsewhere on My Trip."}</p>
    {embedded?null:<Link href="/travel" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-white px-5 font-bold text-black">Open COGIC Travel Hub</Link>}
  </div>
}
