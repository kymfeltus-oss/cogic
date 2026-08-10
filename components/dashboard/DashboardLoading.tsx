/** Lightweight approved-shell loading panel for dashboard Suspense. */
export default function DashboardLoading() {
  return (
    <div className="cl-dash" aria-busy="true" aria-live="polite">
      <div className="cl-dashboard-loading">
        <div className="cl-dashboard-loading__pulse" />
        <div className="cl-dashboard-loading__pulse" style={{ height: "4.5rem" }} />
        <p>Loading your Convocation…</p>
      </div>
    </div>
  );
}
