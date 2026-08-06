"use client";

import Link from "next/link";

import { COGIC_LIVE_PUBLIC_NAME } from "@/lib/brand/public-display";

type ProgramErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProgramError({ reset }: ProgramErrorProps) {
  return (
    <main id="main-content" className="convocation-program-shell">
      <div className="convocation-program-layout">
        <header className="convocation-program-header">
          <p className="convocation-program-kicker">{COGIC_LIVE_PUBLIC_NAME}</p>
          <h1 className="convocation-program-title">118th Holy Convocation Digital Program</h1>
        </header>
        <div className="convocation-program-empty" role="alert">
          <p>The Convocation schedule is temporarily unavailable.</p>
          <div className="convocation-program-card-actions">
            <button type="button" className="convocation-program-btn convocation-program-btn-primary" onClick={reset}>
              Try Again
            </button>
            <Link href="/" className="convocation-program-btn">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
