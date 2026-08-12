import Image from "next/image";

export default function BrandWatermark({
  placement = "default",
}: {
  placement?: "default" | "corner";
}) {
  return (
    <div
      className={placement === "corner" ? "brand-watermark brand-watermark--corner" : "brand-watermark"}
      aria-hidden="true"
    >
      <Image
        src="/branding/cogic-seal.png"
        alt=""
        width={720}
        height={720}
        loading="eager"
      />
    </div>
  );
}
