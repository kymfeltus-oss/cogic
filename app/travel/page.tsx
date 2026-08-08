import Image from "next/image";
import Link from "next/link";
import { Bell, BriefcaseBusiness, CalendarDays, Car, ChevronDown, ChevronRight, CircleUserRound, MapPin, Plane, Star } from "lucide-react";
import TravelHubClient from "@/components/travel/TravelHubClient";
import { publishedHotels } from "@/lib/travel/repository";
import { getUserFromSession } from "@/lib/auth/session";
import { userHotelState } from "@/lib/travel/reservations";
import "./travel-home.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "COGIC Travel | 118th Holy Convocation" };

export default async function TravelPage() {
  const [hotels, user] = await Promise.all([publishedHotels(), getUserFromSession()]);
  const hotelState = user?.id ? await userHotelState(user.id) : null;

  return (
    <main className="ct-page">
      <div className="ct-frame">
        <header className="ct-nav">
          <Link href="/my-convocation" className="ct-brand" aria-label="COGIC STREAM LIVE home">
            <Image
              src="/branding/cogic-seal.png"
              alt=""
              width={256}
              height={256}
              priority
              className="ct-nav-seal"
              sizes="(max-width: 900px) 52px, 208px"
              style={{ width: "clamp(9.5rem, 13vw, 13rem)", height: "clamp(9.5rem, 13vw, 13rem)", maxWidth: "none", objectFit: "cover", objectPosition: "center" }}
            />
            <span className="ct-travel-logo-lockup" aria-label="COGIC Travel">
              <span className="ct-travel-suitcase" aria-hidden="true" />
              <span>
                COGIC <b>Travel</b>
              </span>
            </span>
          </Link>
          <nav aria-label="Travel navigation">
            <Link href="/my-convocation">Home</Link>
            <Link href="/program">Schedule</Link>
            <Link href="/program">Speakers</Link>
            <Link href="/program">Events</Link>
            <Link className="active" href="/travel">
              Travel
            </Link>
            <Link href="/my-convocation">
              More <ChevronDown />
            </Link>
          </nav>
          <div className="ct-user">
            <Bell />
            <CircleUserRound />
          </div>
        </header>

        <section className="ct-hero">
          <Image
            src="/travel-st-louis-hero.png"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 1200px"
            alt="St. Louis skyline and Gateway Arch at sunset"
          />
          <div className="ct-hero-shade" />
          <div className="ct-hero-copy">
            <h1 className="ct-travel-header-lockup">
              <span className="sr-only">COGIC Travel</span>
            </h1>
            <p>Your Convocation journey starts here.</p>
            <div className="ct-event">
              <Image
                src="/branding/cogic-seal.png"
                width={192}
                height={192}
                alt="COGIC seal"
                className="ct-event-seal"
              />
              <div>
                <strong>118th Holy Convocation</strong>
                <span>
                  <MapPin /> St. Louis, Missouri <i /> <CalendarDays /> November 2026
                </span>
              </div>
            </div>
          </div>
        </section>

        {hotelState?.primary ? (
          <section className="mx-[38px] mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-green-400/30 bg-green-400/10 p-5">
            <div>
              <p className="font-black text-green-300">YOUR STAY IS SET ✓</p>
              <h2 className="mt-1 text-xl font-bold">{hotelState.primary.hotel_name_snapshot}</h2>
              <p>
                {hotelState.primary.check_in} – {hotelState.primary.check_out}
              </p>
            </div>
            <Link href="/travel" className="rounded-lg bg-white px-5 py-3 font-bold text-black">
              View COGIC Travel
            </Link>
          </section>
        ) : null}

        <div className="ct-body ct-body-hub">
          <div className="ct-hub-main">
            <TravelHubClient hotels={hotels} />
          </div>

          <aside className="ct-aside">
            <Link href="/travel/getting-around">
              <span>
                <Plane />
              </span>
              <div>
                <strong>Airport Information</strong>
                <small>Lambert–St. Louis International Airport (STL)</small>
              </div>
              <ChevronRight />
            </Link>
            <Link href="/travel/getting-around">
              <span>
                <Car />
              </span>
              <div>
                <strong>Ground Transportation</strong>
                <small>Shuttles, rideshares, taxis & more</small>
              </div>
              <ChevronRight />
            </Link>
            <Link href="/travel">
              <span>
                <BriefcaseBusiness />
              </span>
              <div>
                <strong>COGIC Travel Hub</strong>
                <small>Hotels, flights, and rental cars in one place</small>
              </div>
              <ChevronRight />
            </Link>
            <div className="ct-trip-preview">
              <div>
                <strong>My Trip</strong>
                <Link href="/travel">
                  View Details <ChevronRight />
                </Link>
              </div>
              <p>Your private itinerary is ready when you are.</p>
              <Link href="/travel">Add travel details</Link>
            </div>
          </aside>
        </div>

        <footer className="ct-progress">
          <div className="done">
            <span>✓</span>
            <p>
              <b>Registered</b>
              <small>You&apos;re all set!</small>
            </p>
          </div>
          <i />
          <div className="current">
            <span>
              <BriefcaseBusiness />
            </span>
            <p>
              <b>Travel</b>
              <small>Plan your trip</small>
            </p>
          </div>
          <i />
          <div>
            <span>
              <CalendarDays />
            </span>
            <p>
              <b>My Schedule</b>
              <small>Build your agenda</small>
            </p>
          </div>
          <i />
          <div>
            <span>
              <Star />
            </span>
            <p>
              <b>Ready for Convocation</b>
              <small>See you in St. Louis!</small>
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
