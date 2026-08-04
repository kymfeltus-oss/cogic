"use client";

type LiveVideoBackgroundProps = {
  videoUrl: string | null;
  posterUrl: string | null;
};

export default function LiveVideoBackground({ videoUrl, posterUrl }: LiveVideoBackgroundProps) {
  if (videoUrl) {
    return (
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src={videoUrl}
        poster={posterUrl ?? undefined}
        autoPlay
        playsInline
        muted
        loop
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="absolute inset-0 z-0 h-full w-full overflow-hidden bg-brand-black" aria-hidden="true">
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt="" className="h-full w-full object-cover opacity-90" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a2e]/80 via-[#2d1045]/70 to-[#0a1628]/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_28%,rgba(255,255,255,0.14),transparent_62%)]" />
    </div>
  );
}
