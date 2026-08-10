import type { Metadata } from "next";
import SocialCommunityClient from "@/components/social/SocialCommunityClient";
import "./social.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "COGIC Connect | COGIC LIVE",
  description: "The authenticated COGIC LIVE community feed and messaging.",
};

export default function SocialPage() {
  return <SocialCommunityClient />;
}
