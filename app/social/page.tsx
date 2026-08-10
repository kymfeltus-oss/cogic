import type { Metadata } from "next";
import SocialCommunityClient from "@/components/social/SocialCommunityClient";
import "./social.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "COGIC Social | COGIC LIVE",
  description: "The authenticated COGIC LIVE attendee community.",
};

export default function SocialPage() {
  return <SocialCommunityClient />;
}
