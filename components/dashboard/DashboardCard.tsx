import type { ReactNode } from "react";

export default function DashboardCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <article className={`dashboard-card ${className}`}><h2>{title}</h2>{children}</article>;
}
