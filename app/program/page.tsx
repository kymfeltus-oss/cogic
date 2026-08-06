import type { Metadata } from "next";

import ConvocationProgram from "@/components/program/ConvocationProgram";
import { loadConvocationProgram } from "@/lib/program/load-program";
import "./program.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Digital Program | 118th Holy Convocation",
  description:
    "Official published schedule for the 118th Holy Convocation — worship, General Assembly, classes, and special events.",
};

type ProgramPageProps = {
  searchParams: Promise<{
    day?: string;
    category?: string;
    q?: string;
  }>;
};

export default async function ProgramPage({ searchParams }: ProgramPageProps) {
  const params = await searchParams;
  const { view } = await loadConvocationProgram({
    day: params.day,
    category: params.category,
    search: params.q,
  });

  return (
    <main id="main-content">
      <ConvocationProgram view={view} />
    </main>
  );
}
