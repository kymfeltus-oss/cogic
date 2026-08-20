import Image from "next/image";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  MapPin,
  Menu,
  Plane,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import TravelHubClient from "@/components/travel/TravelHubClient";
import { publishedHotels, publicTravelInfo } from "@/lib/travel/repository";
import { getUserFromSession } from "@/lib/auth/session";
import { userHotelState } from "@/lib/travel/reservations";
import { fetchAttendeeProfileRecord } from "@/lib/experience/fetch-attendee-profile";
import { buildAttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { resolveTravelRegistrationEligibility } from "@/lib/travel/registration-eligibility";
import "./travel-home.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "COGIC Travel | 118th Holy Convocation" };

export default async function TravelPage() {
  const [hotels, user, travelInfo] = await Promise.all([
    publishedHotels(),
    getUserFromSession(),
    publicTravelInfo(),
  ]);
  const [hotelState, attendeeRecord, registrationEligibility] = await Promise.all([
    user?.id ? userHotelState(user.id) : Promise.resolve(null),
    user?.id ? fetchAttendeeProfileRecord(user.id) : Promise.resolve(null),
    resolveTravelRegistrationEligibility(user?.id),
  ]);
  const hasGettingAround =
    travelInfo.airports.length > 0 ||
    travelInfo.transport.length > 0 ||
    travelInfo.announcements.length > 0;
  const profile = buildAttendeeProfileSnapshot(user, attendeeRecord);
  const profileName = [profile.title, profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const profileHref = user ? "/my-convocation?view=profile" : "/login?next=%2Ftravel";

  return (
    <main id="main-content" className="ct-page">
      <div className="ct-frame">
        <header className="ct-header">
          <Link href="/my-convocation" className="ct-menu-control" aria-label="Open My Convocation">
            <Menu aria-hidden="true" />
          </Link>

          <p className="ct-wordmark" aria-label="COGIC Travel">
            <span>COGIC</span>
            <strong>TRAVEL</strong>
          </p>

          <Link href={profileHref} className="ct-account" aria-label="Open your account">
            <span className="ct-account__avatar" aria-hidden="true">
              {profile.avatarUrl ? (
                <Image src={profile.avatarUrl} alt="" fill sizes="52px" unoptimized />
              ) : (
                <span>{profile.profileInitials || <UserRound />}</span>
              )}
            </span>
            <span className="ct-account__copy">
              <small>Welcome back,</small>
              <strong>{profileName || "Guest"}</strong>
            </span>
            <ChevronDown aria-hidden="true" />
          </Link>
        </header>

        <section className="ct-hero" aria-labelledby="travel-convocation-title">
          <div className="ct-hero__media">
            <Image
              src="/travel-st-louis-hero.png"
              fill
              priority
              sizes="430px"
              alt="St. Louis skyline and Gateway Arch at sunset"
              className="ct-hero__image"
            />
            <div className="ct-hero-shade" />
          </div>
          <div className="ct-hero__content">
            <div className="ct-hero-copy">
              <p className="ct-hero__eyebrow">118th</p>
              <h1 id="travel-convocation-title">
                <span>Holy</span>
                <span>Convocation</span>
              </h1>
              <div className="ct-event">
                <span>
                  <MapPin aria-hidden="true" /> St. Louis, Missouri
                </span>
                <span>
                  <CalendarDays aria-hidden="true" /> November 2026
                </span>
              </div>
              <p className="ct-hero__journey">
                Your Convocation journey <em>starts here.</em>
              </p>
            </div>
          </div>
        </section>

        {hotelState?.primary ? (
          <section id="saved-trip" className="ct-confirmed-stay">
            <span className="ct-confirmed-stay__icon" aria-hidden="true">
              <Building2 />
            </span>
            <div className="ct-confirmed-stay__copy">
              <p aria-label="YOUR STAY IS SET">
                Your stay is <strong>set</strong> <CircleCheck aria-hidden="true" />
              </p>
              <h2>{hotelState.primary.hotel_name_snapshot}</h2>
              <span>
                {hotelState.primary.check_in} &ndash; {hotelState.primary.check_out}
              </span>
            </div>
            <Link href="/travel/trip" className="ct-neon-button ct-confirmed-stay__action">
              Open My Trip <ChevronRight aria-hidden="true" />
            </Link>
          </section>
        ) : null}

        <div className="ct-body ct-body-hub">
          <TravelHubClient hotels={registrationEligibility.officialHousingEligible ? hotels : []} hasSavedStay={Boolean(hotelState?.primary)} housingEligibility={{eligible:registrationEligibility.officialHousingEligible,productName:registrationEligibility.productName,maximumNights:registrationEligibility.maximumHousingNights}} />
        </div>

        <section className="ct-helpful-links" aria-labelledby="travel-helpful-links">
          <div className="ct-helpful-links__heading">
            <span />
            <h2 id="travel-helpful-links">Helpful Travel Links</h2>
            <span />
          </div>
          <div className="ct-helpful-links__rows">
            {hasGettingAround ? (
              <>
                <Link href="/travel/getting-around">
                  <span>
                    <Plane />
                  </span>
                  <div>
                    <strong>Airport Information</strong>
                    <small>Lambert&ndash;St. Louis International Airport (STL)</small>
                  </div>
                  <ChevronRight />
                </Link>
                <Link href="/travel/getting-around">
                  <span>
                    <Car />
                  </span>
                  <div>
                    <strong>Ground Transportation</strong>
                    <small>Shuttles, rideshares, taxis &amp; more</small>
                  </div>
                  <ChevronRight />
                </Link>
              </>
            ) : null}
            <Link href="/travel/trip">
              <span>
                <BriefcaseBusiness />
              </span>
              <div>
                <strong>My Trip</strong>
                <small>Save hotel, flight, and transportation details</small>
              </div>
              <ChevronRight />
            </Link>
            <Link href="/travel/group">
              <span>
                <Building2 />
              </span>
              <div>
                <strong>Group Travel (10+)</strong>
                <small>Church corporate quote requests for Pastors &amp; Overseers</small>
              </div>
              <ChevronRight />
            </Link>
          </div>
        </section>

        <footer className="ct-footer">
          <div className="ct-footer__church">
            <span className="ct-footer__seal" aria-hidden="true">
              <Image src="/branding/cogic-seal.png" fill sizes="48px" alt="" />
            </span>
            <span>
              &copy; 2026 Church of God in Christ, Inc.
              <small>All rights reserved.</small>
            </span>
          </div>
          <p className="ct-footer__scripture">
            &ldquo;One Church, One Mission, One Future.&rdquo;
            <small>Matthew 28:19&ndash;20</small>
          </p>
          <div className="ct-footer__trust">
            <span>
              Secure. Trusted. Official.
              <small>Powered by COGIC Travel</small>
            </span>
            <ShieldCheck aria-hidden="true" />
          </div>
        </footer>
      </div>
    </main>
  );
}
