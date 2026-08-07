import Image from "next/image";
import Link from "next/link";
import { Bell, BedDouble, BriefcaseBusiness, Building2, CalendarDays, Car, ChevronDown, ChevronRight, CircleUserRound, MapPin, Plane, Search, ShieldCheck, Star, UsersRound } from "lucide-react";
import { publishedHotels } from "@/lib/travel/repository";
import { getUserFromSession } from "@/lib/auth/session";
import { userHotelState } from "@/lib/travel/reservations";
import "./travel-home.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "COGIC Travel | 118th Holy Convocation" };

const money = (cents:number,currency="USD") => new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(cents/100);

export default async function TravelPage(){
  const [hotels,user]=await Promise.all([publishedHotels(),getUserFromSession()]);
  const hotelState=user?.id?await userHotelState(user.id):null;
  return <main className="ct-page">
    <div className="ct-frame">
      <header className="ct-nav">
        <Link href="/my-convocation" className="ct-brand" aria-label="COGIC STREAM LIVE home">
          <span className="ct-primary-travel-logo"><Image src="/my-sanctuary/cogic-live-logo.png" width={320} height={68} alt="COGIC Live" /></span>
          <span className="ct-brand-rule"/><span className="ct-travel-logo-lockup" aria-label="COGIC Travel"><span className="ct-travel-suitcase" aria-hidden="true"/><span>COGIC <b>Travel</b></span></span>
        </Link>
        <nav aria-label="Travel navigation">
          <Link href="/my-convocation">Home</Link><Link href="/program">Schedule</Link><Link href="/program">Speakers</Link><Link href="/program">Events</Link><Link className="active" href="/travel">Travel</Link><Link href="/my-convocation">More <ChevronDown/></Link>
        </nav>
        <div className="ct-user"><Bell/><span>3</span><CircleUserRound/></div>
      </header>

      <section className="ct-hero">
        <Image src="/travel-st-louis-hero.png" fill priority sizes="(max-width: 900px) 100vw, 1200px" alt="St. Louis skyline and Gateway Arch at sunset" />
        <div className="ct-hero-shade"/>
        <div className="ct-hero-copy">
          <h1 className="ct-travel-header-lockup"><span className="sr-only">COGIC Travel</span></h1>
          <p>Your Convocation journey starts here.</p>
          <div className="ct-event"><Image src="/branding/cogic-seal.png" width={58} height={58} alt="COGIC seal"/><div><strong>118th Holy Convocation</strong><span><MapPin/> St. Louis, Missouri <i/> <CalendarDays/> November 2026</span></div></div>
        </div>
      </section>

      {hotelState?.primary?<section className="mx-[38px] mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-green-400/30 bg-green-400/10 p-5"><div><p className="font-black text-green-300">YOUR STAY IS SET ✓</p><h2 className="mt-1 text-xl font-bold">{hotelState.primary.hotel_name_snapshot}</h2><p>{hotelState.primary.check_in} – {hotelState.primary.check_out}</p></div><Link href="/my-convocation/travel" className="rounded-lg bg-white px-5 py-3 font-bold text-black">View My Trip</Link></section>:null}

      <section className="ct-search" aria-label="Travel search">
        <div className="ct-tabs"><Link className="active" href="/travel/hotels"><BedDouble/> Hotels</Link><Link href="/travel/flights"><Plane/> Flights</Link><Link href="/travel/cars"><Car/> Rental Cars</Link></div>
        <div className="ct-search-fields"><div><MapPin/> St. Louis, MO</div><div><CalendarDays/> Nov 9 – Nov 15, 2026</div><div><UsersRound/> 1 Room, 2 Guests</div><Link href="/travel/hotels"><Search/> Search</Link></div>
      </section>

      <div className="ct-body">
        <section className="ct-hotels">
          <div className="ct-section-head"><div><h2>Official COGIC Hotels</h2><p><ShieldCheck/> Negotiated rates. Preferred locations. Support the mission.</p></div><Link href="/travel/hotels">View All Hotels <ChevronRight/></Link></div>
          <div className="ct-hotel-grid">
            {hotels.slice(0,3).map(h=><article className="ct-hotel-card" key={h.id}>
              <div className="ct-hotel-image">{h.image_url?<Image src={h.image_url} fill sizes="350px" alt={h.name}/>:<div className="ct-hotel-placeholder"><Building2/><span>Official hotel image coming soon</span></div>}{h.distance_label?<span>{h.distance_label}</span>:null}</div>
              <div className="ct-hotel-copy"><p>{h.cogic_designation==="BISHOPS"?"BISHOPS HOTEL":"OFFICIAL COGIC HOUSING"}{h.minimum_nights?` · ${h.minimum_nights} NIGHT MINIMUM`:""}</p><h3>{h.name}</h3><strong>{h.negotiated_rate_cents!=null?`FROM ${money(h.negotiated_rate_cents,h.rate_currency)} / NIGHT`:"Rate information coming soon."}</strong><p>{h.travel_hotel_room_types?.map(r=>r.name).join(" · ")}</p><Link href={`/travel/hotels/${h.slug||h.id}`}>View Rooms & Availability</Link></div>
            </article>)}
            {!hotels.length?<div className="ct-hotel-empty"><ShieldCheck/><h3>Official COGIC hotels are coming soon.</h3><p>Published hotels and verified negotiated rates will appear here. We never display invented pricing or availability.</p><Link href="/travel/hotels">Hotel updates</Link></div>:null}
          </div>
        </section>

        <aside className="ct-aside">
          <Link href="/travel/getting-around"><span><Plane/></span><div><strong>Airport Information</strong><small>Lambert–St. Louis International Airport (STL)</small></div><ChevronRight/></Link>
          <Link href="/travel/getting-around"><span><Car/></span><div><strong>Ground Transportation</strong><small>Shuttles, rideshares, taxis & more</small></div><ChevronRight/></Link>
          <Link href="/my-convocation/travel"><span><BriefcaseBusiness/></span><div><strong>My Trip</strong><small>View your travel plans, reservations, & details</small></div><ChevronRight/></Link>
          <div className="ct-trip-preview"><div><strong>My Trip</strong><Link href="/my-convocation/travel">View Details <ChevronRight/></Link></div><p>Your private itinerary is ready when you are.</p><Link href="/my-convocation/travel">Add travel details</Link></div>
        </aside>
      </div>

      <footer className="ct-progress">
        <div className="done"><span>✓</span><p><b>Registered</b><small>You&apos;re all set!</small></p></div><i/>
        <div className="current"><span><BriefcaseBusiness/></span><p><b>Travel</b><small>Plan your trip</small></p></div><i/>
        <div><span><CalendarDays/></span><p><b>My Schedule</b><small>Build your agenda</small></p></div><i/>
        <div><span><Star/></span><p><b>Ready for Convocation</b><small>See you in St. Louis!</small></p></div>
      </footer>
    </div>
  </main>
}
