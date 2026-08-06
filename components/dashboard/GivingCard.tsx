import Link from "next/link";
import { ArrowRight, HeartHandshake } from "lucide-react";
import DashboardCard from "@/components/dashboard/DashboardCard";

export default function GivingCard() {
  return (
    <DashboardCard title="Giving" className="giving-card">
      <div className="giving-card__heart"><HeartHandshake aria-hidden="true" /></div>
      <p className="giving-card__label">COGIC Giving</p>
      <strong>Support the mission of the<br />118th Holy Convocation.</strong>
      <Link href="/giving" className="dashboard-button">Give Now <ArrowRight aria-hidden="true" /></Link>
    </DashboardCard>
  );
}
