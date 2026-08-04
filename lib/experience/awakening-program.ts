import {
  Cross,
  Gift,
  HeartHandshake,
  Mic2,
  Music2,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AwakeningProgramSectionKind =
  | "speaker"
  | "music"
  | "offering"
  | "benediction"
  | "tribute"
  | "intermission";

export type AwakeningProgramPerson = {
  name: string;
  role: string;
  bio: string;
  image?: string;
  socials?: Array<{
    label: string;
    href: string;
  }>;
};

export type AwakeningProgramSection = {
  id: string;
  time: string;
  number: string;
  title: string;
  subtitle?: string;
  kind: AwakeningProgramSectionKind;
  accent: "pink" | "blue" | "purple";
  icon: LucideIcon;
  people?: AwakeningProgramPerson[];
  songs?: string[];
  lovedOnes?: Array<{
    name: string;
    message?: string;
    photo?: string;
  }>;
  modalTitle?: string;
  modalMessage?: string;
};

export const awakeningProgramLinks = {
  givingUrl: process.env.NEXT_PUBLIC_AWAKENING_GIVING_URL ?? "/experience/giving",
  prayerRequestUrl: process.env.NEXT_PUBLIC_AWAKENING_PRAYER_REQUEST_URL ?? "/prayer",
  artistUrl: process.env.NEXT_PUBLIC_AWAKENING_ARTIST_URL ?? "/experience/music",
  programShareUrl: process.env.NEXT_PUBLIC_AWAKENING_PROGRAM_URL ?? "/program",
};

export const awakeningProgramSections: AwakeningProgramSection[] = [
  {
    id: "worship",
    time: "7:30 PM",
    number: "01",
    title: "Worship",
    subtitle: "Pastor Billy Mitchell",
    kind: "speaker",
    accent: "pink",
    icon: Music2,
    people: [
      {
        name: "Pastor Billy Mitchell",
        role: "Worship",
        bio: "Opening the room with worship and setting the atmosphere for the night.",
        image: "/awakening/speakers/billy-mitchell.png",
      },
    ],
  },
  {
    id: "welcome",
    time: "7:45 PM",
    number: "02",
    title: "Welcome & Intro of Ian Craig and 300",
    subtitle: "Hosts: Carmina Barnett and Pastor Chris Wesley",
    kind: "speaker",
    accent: "pink",
    icon: UserRound,
    people: [
      {
        name: "Carmina Barnett",
        role: "Host",
        bio: "Welcoming guests into the 300 Awakening experience.",
        image: "/awakening/speakers/carmina-barnett.png",
      },
      {
        name: "Pastor Chris Wesley",
        role: "Host",
        bio: "Guiding the room into the purpose and flow of the evening.",
        image: "/awakening/speakers/pastor-chris-wesley.png",
      },
    ],
  },
  {
    id: "prayer",
    time: "8:00 PM",
    number: "03",
    title: "Prayer of Consecration",
    subtitle: "Cynthia Diggs",
    kind: "speaker",
    accent: "blue",
    icon: HeartHandshake,
    people: [
      {
        name: "Cynthia Diggs",
        role: "Prayer of Consecration",
        bio: "Covering the gathering in prayer and consecrating the night.",
        image: "/awakening/speakers/cynthia-diggs.png",
      },
    ],
  },
  {
    id: "first-set",
    time: "8:15 PM",
    number: "04",
    title: "First Set: Ian Craig & 300",
    subtitle: "Song Order",
    kind: "music",
    accent: "pink",
    icon: Mic2,
    songs: ["More", "Yahweh You Are", "Grace", "Watch Him Work"],
    modalTitle: "Ian Craig & 300",
    modalMessage: "Live. Empower. Transform.",
  },
  {
    id: "offering",
    time: "8:55 PM",
    number: "05",
    title: "Offering",
    subtitle: "Vital Seed Giving",
    kind: "offering",
    accent: "blue",
    icon: Gift,
    modalTitle: "Every Gift Has A Frequency.",
    modalMessage: "Sow into the sound and help carry the movement forward.",
  },
  {
    id: "intermission",
    time: "9:10 PM",
    number: "06",
    title: "Intermission Guest",
    subtitle: "Cordell Booker",
    kind: "intermission",
    accent: "purple",
    icon: Star,
    people: [
      {
        name: "Cordell Booker",
        role: "Intermission Guest",
        bio: "A featured moment during intermission.",
        image: "/awakening/speakers/cordell-booker.png",
      },
    ],
  },
  {
    id: "second-set",
    time: "9:30 PM",
    number: "07",
    title: "Second Set: Ian Craig & 300",
    subtitle: "Song Order",
    kind: "music",
    accent: "pink",
    icon: Mic2,
    songs: ["Good Room", "All Day", "Turning Around"],
    modalTitle: "Ian Craig & 300",
    modalMessage: "One sound. One purpose. One awakening.",
  },
  {
    id: "tribute",
    time: "10:10 PM",
    number: "08",
    title: "Tribute To Our New Angels",
    subtitle: "Passed away loved ones",
    kind: "tribute",
    accent: "blue",
    icon: Sparkles,
    lovedOnes: [
      { name: "Milton Leblanc" },
      { name: "Lady Ruth Trotter-Eiland" },
      { name: "Jimmy Wyatt" },
      { name: "Lady Marye Mitchell-Bell" },
    ],
    modalTitle: "Tribute To Our New Angels",
    modalMessage: "We honor every life, every legacy, and every love still speaking.",
  },
  {
    id: "benediction",
    time: "10:30 PM",
    number: "09",
    title: "Benediction",
    kind: "benediction",
    accent: "purple",
    icon: Cross,
    modalTitle: "Need Prayer?",
    modalMessage: "Our team would be honored to pray with you.",
  },
];
