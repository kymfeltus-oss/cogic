"use client";

import Image from "next/image";
import { ChevronRight, ExternalLink, Music, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  awakeningProgramLinks,
  awakeningProgramSections,
  type AwakeningProgramPerson,
  type AwakeningProgramSection,
} from "@/lib/experience/awakening-program";
import {
  DEFAULT_COUNTDOWN_CONFIG,
  type EventCountdownConfig,
} from "@/lib/live/countdown-config";
import { cn } from "@/lib/utils";

type ProgramCountdownDetails = EventCountdownConfig & {
  eventLocation?: string;
  livestreamAvailability?: string;
};

type ProgramEventDetails = {
  weekday: string;
  date: string;
  mobileDate: string;
  time: string;
  location: string;
  livestream: string;
};

function formatProgramEventDetails(config: ProgramCountdownDetails): ProgramEventDetails {
  const start = new Date(config.start_time);
  const timeZone = config.schedule_timezone || DEFAULT_COUNTDOWN_CONFIG.schedule_timezone;
  const validStart = Number.isNaN(start.getTime())
    ? new Date(DEFAULT_COUNTDOWN_CONFIG.start_time)
    : start;

  return {
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
    }).format(validStart),
    date: new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(validStart),
    mobileDate: new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
    }).format(validStart),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(validStart),
    location: config.eventLocation?.trim() || "New Orleans, LA",
    livestream: config.livestreamAvailability?.trim() || "Available worldwide",
  };
}

function PersonAvatar({ person, large = false }: { person: AwakeningProgramPerson; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = person.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  if (person.image && !failed) {
    return (
      <Image
        src={person.image}
        alt={person.name}
        width={large ? 160 : 76}
        height={large ? 160 : 76}
        className={cn(
          "awakening-program-avatar",
          large && "awakening-program-avatar--large",
        )}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        "awakening-program-avatar awakening-program-avatar--fallback",
        large && "awakening-program-avatar--large",
      )}
      aria-label={person.name}
    >
      {initials}
    </span>
  );
}

function ProgramRow({
  section,
  onOpen,
}: {
  section: AwakeningProgramSection;
  onOpen: (section: AwakeningProgramSection) => void;
}) {
  const Icon = section.icon;

  return (
    <button
      type="button"
      className="awakening-program-row"
      data-accent={section.accent}
      onClick={() => onOpen(section)}
    >
      <span className="awakening-program-row__time">{section.time}</span>
      <span className="awakening-program-row__media" aria-hidden>
        {section.people?.length ? (
          <span className="awakening-program-row__avatars">
            {section.people.slice(0, 2).map((person) => (
              <PersonAvatar key={person.name} person={person} />
            ))}
          </span>
        ) : (
          <span className="awakening-program-row__icon">
            <Icon size={32} strokeWidth={1.8} />
          </span>
        )}
      </span>
      <span className="awakening-program-row__number">{section.number}</span>
      <span className="awakening-program-row__copy">
        <span className="awakening-program-row__title">{section.title}</span>
        {section.subtitle ? (
          <span className="awakening-program-row__subtitle">{section.subtitle}</span>
        ) : null}
        {section.songs ? (
          <span className="awakening-program-row__songs">
            {section.songs.map((song, index) => `${index + 1}. ${song}`).join("  ")}
          </span>
        ) : null}
      </span>
      <ChevronRight className="awakening-program-row__chevron" size={24} aria-hidden />
    </button>
  );
}

function CandleTribute({ section }: { section: AwakeningProgramSection }) {
  return (
    <div className="awakening-program-tribute">
      <div className="awakening-program-candle" aria-hidden>
        <span className="awakening-program-candle__flame" />
        <span className="awakening-program-candle__halo" />
        <span className="awakening-program-candle__base" />
      </div>
      <div className="awakening-program-tribute__names">
        {section.lovedOnes?.map((lovedOne) => (
          <div key={lovedOne.name} className="awakening-program-tribute__name">
            <span>{lovedOne.name}</span>
            {lovedOne.message ? <p>{lovedOne.message}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalBody({ section }: { section: AwakeningProgramSection }) {
  if (section.kind === "offering") {
    return (
      <>
        <div className="awakening-program-offering-art">
          <GiftArtwork />
        </div>
        <a className="awakening-program-modal__primary" href={awakeningProgramLinks.givingUrl}>
          Give Now
          <ExternalLink size={18} aria-hidden />
        </a>
      </>
    );
  }

  if (section.kind === "benediction") {
    return (
      <>
        <div className="awakening-program-prayer-art">
          <span>Need Prayer?</span>
        </div>
        <a className="awakening-program-modal__primary" href={awakeningProgramLinks.prayerRequestUrl}>
          Request Prayer
          <ExternalLink size={18} aria-hidden />
        </a>
      </>
    );
  }

  if (section.kind === "tribute") {
    return <CandleTribute section={section} />;
  }

  if (section.kind === "music") {
    return (
      <>
        <div className="awakening-program-band-art">
          <Image
            src="/branding/awakening-lockup.png"
            alt="Ian Craig and 300 Awakening"
            width={900}
            height={520}
            className="awakening-program-band-art__image"
            priority={false}
          />
        </div>
        <ol className="awakening-program-song-list">
          {section.songs?.map((song) => <li key={song}>{song}</li>)}
        </ol>
        <div className="awakening-program-modal__links">
          <a href={awakeningProgramLinks.artistUrl}>
            <Music size={18} aria-hidden />
            Follow the Music
          </a>
          <a href={awakeningProgramLinks.artistUrl}>
            <Play size={18} aria-hidden />
            Stream
          </a>
        </div>
      </>
    );
  }

  return (
    <div className="awakening-program-people">
      {section.people?.map((person) => (
        <article key={person.name} className="awakening-program-person">
          <PersonAvatar person={person} large />
          <div>
            <h3>{person.name}</h3>
            <p className="awakening-program-person__role">{person.role}</p>
            <p>{person.bio}</p>
            <div className="awakening-program-modal__links">
              <a href={awakeningProgramLinks.artistUrl}>
                <ExternalLink size={18} aria-hidden />
                Connect
              </a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function GiftArtwork() {
  return (
    <div className="awakening-program-seed-art" aria-label="Vital Seed Giving artwork">
      <span className="awakening-program-seed-art__orb" />
      <span className="awakening-program-seed-art__mark">Vital Seed</span>
      <span className="awakening-program-seed-art__frequency" />
    </div>
  );
}

function ProgramModal({
  section,
  onClose,
}: {
  section: AwakeningProgramSection;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="awakening-program-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="awakening-program-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={(event) => {
        touchStartY.current = event.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(event) => {
        const startY = touchStartY.current;
        const endY = event.changedTouches[0]?.clientY;
        touchStartY.current = null;
        if (startY !== null && endY !== undefined && endY - startY > 90) onClose();
      }}
    >
      <div className="awakening-program-modal__card" data-accent={section.accent} ref={cardRef}>
        <button
          type="button"
          className="awakening-program-modal__close"
          aria-label="Close program details"
          onClick={onClose}
        >
          <X size={22} aria-hidden />
        </button>
        <p className="awakening-program-modal__eyebrow">
          {section.time} · {section.number}
        </p>
        <h2 id="awakening-program-modal-title">
          {section.modalTitle ?? section.title}
        </h2>
        {section.modalMessage ?? section.subtitle ? (
          <p className="awakening-program-modal__message">
            {section.modalMessage ?? section.subtitle}
          </p>
        ) : null}
        <ModalBody section={section} />
      </div>
    </div>
  );
}

export default function AwakeningProgramClient() {
  const [selectedSection, setSelectedSection] = useState<AwakeningProgramSection | null>(null);
  const [countdownDetails, setCountdownDetails] = useState<ProgramCountdownDetails>({
    ...DEFAULT_COUNTDOWN_CONFIG,
    eventLocation: "New Orleans, LA",
    livestreamAvailability: "Available worldwide",
  });

  const openSection = useCallback((section: AwakeningProgramSection) => {
    setSelectedSection(section);
    window.history.replaceState(null, "", `#${section.id}`);
  }, []);

  const closeSection = useCallback(() => {
    setSelectedSection(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    const openFromHash = () => {
      const id = window.location.hash.replace("#", "");
      if (!id) return;
      const next = awakeningProgramSections.find((section) => section.id === id);
      if (next) setSelectedSection(next);
    };

    requestAnimationFrame(openFromHash);
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCountdownDetails() {
      try {
        const response = await fetch("/api/countdown", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as ProgramCountdownDetails;
        if (!cancelled) setCountdownDetails(data);
      } catch {
        // Keep code defaults when countdown details are unavailable.
      }
    }

    void loadCountdownDetails();
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredPeople = useMemo(
    () =>
      awakeningProgramSections
        .flatMap((section) => section.people ?? [])
        .filter((person, index, people) => people.findIndex((item) => item.name === person.name) === index),
    [],
  );
  const eventDetails = useMemo(
    () => formatProgramEventDetails(countdownDetails),
    [countdownDetails],
  );

  return (
    <main className="awakening-program" id="main-content">
      <div className={cn("awakening-program__page", selectedSection && "awakening-program__page--blurred")}>
        <header className="awakening-program-hero">
          <p className="awakening-program-hero__presenter">Parable Entertainment Presents</p>
          <Image
            src="/branding/awakening-lockup.png"
            alt="Ian Craig and 300 Awakening"
            width={1600}
            height={900}
            className="awakening-program-hero__lockup"
            priority
          />
          <div className="awakening-program-mobile-details" aria-label="Event details">
            <span>{eventDetails.weekday.slice(0, 3)} · {eventDetails.mobileDate}</span>
            <span>{eventDetails.time}</span>
            <span>{eventDetails.location}</span>
          </div>
        </header>

        <section className="awakening-program-shell" aria-label="300 Awakening digital program">
          <div className="awakening-program-list">
            <div className="awakening-program-list__heading">
              <span />
              <h1>Digital Program</h1>
              <span />
            </div>
            <div className="awakening-program-list__rows">
              {awakeningProgramSections.map((section) => (
                <ProgramRow key={section.id} section={section} onOpen={openSection} />
              ))}
            </div>
            <p className="awakening-program-list__note">Program subject to change</p>
          </div>

          <aside className="awakening-program-side" aria-label="Event details">
            <section>
              <h2>Event Details</h2>
              <p><strong>{eventDetails.weekday}</strong><span>{eventDetails.date}</span></p>
              <p><strong>{eventDetails.time}</strong><span>Live from {eventDetails.location}</span></p>
              <p><strong>Livestream</strong><span>{eventDetails.livestream}</span></p>
            </section>
            <section>
              <h2>Featured Artists</h2>
              <div className="awakening-program-featured">
                <Image
                  src="/branding/awakening-lockup.png"
                  alt="300 Awakening featured artists"
                  width={700}
                  height={430}
                />
              </div>
            </section>
            <section>
              <h2>Program Guests</h2>
              <div className="awakening-program-guest-grid">
                {featuredPeople.map((person) => (
                  <div key={person.name} className="awakening-program-guest">
                    <PersonAvatar person={person} />
                    <span>{person.name}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <footer className="awakening-program-footer">
          <span>Share The Experience</span>
          <strong>#AWAKENINGLIVE</strong>
          <a href={awakeningProgramLinks.programShareUrl}>Scan To Connect</a>
        </footer>
      </div>

      {selectedSection ? <ProgramModal section={selectedSection} onClose={closeSection} /> : null}
    </main>
  );
}
