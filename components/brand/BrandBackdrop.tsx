import BrandWatermark from "@/components/brand/BrandWatermark";

export type BrandBackdropVariant =
  | "default"
  | "registration"
  | "travel"
  | "live"
  | "giving"
  | "replay"
  | "sanctuary"
  | "owner";

const WATERMARK_BY_VARIANT: Record<BrandBackdropVariant, "default" | "corner" | "none"> = {
  default: "default",
  registration: "default",
  travel: "corner",
  live: "none",
  giving: "default",
  replay: "corner",
  sanctuary: "default",
  owner: "none",
};

export default function BrandBackdrop({
  variant = "default",
  watermark,
}: {
  variant?: BrandBackdropVariant;
  watermark?: "default" | "corner" | "none";
}) {
  const mark = watermark ?? WATERMARK_BY_VARIANT[variant];

  return (
    <div className={`brand-backdrop brand-backdrop--${variant}`} aria-hidden="true">
      <span className="brand-backdrop__flare brand-backdrop__flare--violet" />
      <span className="brand-backdrop__flare brand-backdrop__flare--magenta" />
      <span className="brand-backdrop__flare brand-backdrop__flare--blue" />
      <span className="brand-backdrop__wave brand-backdrop__wave--upper" />
      <span className="brand-backdrop__wave" />
      {mark === "none" ? null : <BrandWatermark placement={mark} />}
    </div>
  );
}

export function brandVariantFromPath(pathname: string | null | undefined): BrandBackdropVariant {
  const path = pathname || "/";
  if (path.startsWith("/owner") || path.startsWith("/admin") || path.startsWith("/ops")) return "owner";
  if (path.startsWith("/giving") || path.startsWith("/experience/giving") || path.startsWith("/seeds")) return "giving";
  if (path.startsWith("/travel") || path.startsWith("/my-convocation/travel")) return "travel";
  if (path.startsWith("/live") || path.startsWith("/experience/live") || path.startsWith("/experience/holding")) return "live";
  if (path.startsWith("/replays") || path.startsWith("/dashboard/merch")) return "replay";
  if (path.startsWith("/register") || path.startsWith("/registration") || path.startsWith("/tickets") || path.startsWith("/housing")) {
    return "registration";
  }
  if (
    path === "/my-convocation" ||
    path.startsWith("/my-convocation/") ||
    path === "/my-sanctuary" ||
    path.startsWith("/my-sanctuary/")
  ) {
    return "sanctuary";
  }
  return "default";
}
