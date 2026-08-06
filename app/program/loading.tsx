import { COGIC_LIVE_PUBLIC_NAME } from "@/lib/brand/public-display";

export default function ProgramLoading() {
  return (
    <main id="main-content" className="convocation-program-shell">
      <div className="convocation-program-layout">
        <header className="convocation-program-header">
          <p className="convocation-program-kicker">{COGIC_LIVE_PUBLIC_NAME}</p>
          <h1 className="convocation-program-title">118th Holy Convocation Digital Program</h1>
          <p className="convocation-program-lede">Loading the published schedule…</p>
        </header>
      </div>
    </main>
  );
}
