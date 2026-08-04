"use client";

import type { CSSProperties, ReactNode } from "react";

type BroadcastCanvasProps = {
  children: ReactNode;
  className?: string;
  feedClassName?: string;
  style?: CSSProperties;
};

export function BroadcastVideoCanvas({ children, className = "", feedClassName = "", style }: BroadcastCanvasProps) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden bg-black ${className}`}
      style={{
        width: "100%",
        maxWidth: 1920,
        ...style,
      }}
    >
      <div
        className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(0,168,255,0.24),transparent_24%),radial-gradient(circle_at_78%_76%,rgba(255,47,175,0.18),transparent_30%),linear-gradient(180deg,#10132c_0%,#050710_52%,#010102_100%)] ${feedClassName}`}
      />
      <div className="absolute inset-[5%] pointer-events-none border border-white/14" />
      {children}
    </div>
  );
}

type BroadcastLowerThirdPresetProps = {
  mainText: string;
  subtitleText?: string | null;
  logoUrl?: string | null;
  className?: string;
};

export function BroadcastLowerThirdPreset({
  mainText,
  subtitleText,
  logoUrl,
  className = "",
}: BroadcastLowerThirdPresetProps) {
  return (
    <BroadcastVideoCanvas className={className}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="absolute right-[6%] top-[6%] max-h-[13%] max-w-[24%] object-contain drop-shadow-[0_0_18px_rgba(0,168,255,0.68)]"
        />
      ) : null}

      <div className="absolute inset-x-[5%] bottom-[5%]">
        <div className="relative overflow-hidden rounded-[10px] border border-white/14 bg-[linear-gradient(100deg,rgba(1,5,15,0.92),rgba(7,20,42,0.9)_42%,rgba(28,8,30,0.88))] px-[3.2%] py-[1.8%] shadow-[0_22px_60px_rgba(0,0,0,0.54),0_0_36px_rgba(0,168,255,0.18)] backdrop-blur-md">
          <div className="absolute inset-y-0 left-0 w-2 bg-[linear-gradient(180deg,#00ddeb,#1677ff,#ff2faf)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          <p className="font-ui text-[clamp(1.15rem,3.1vw,4.25rem)] font-black uppercase leading-[0.95] tracking-[0.04em] text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)]">
            {mainText}
          </p>
          {subtitleText ? (
            <p className="mt-[0.65%] font-ui text-[clamp(0.74rem,1.15vw,1.58rem)] font-black uppercase leading-tight tracking-[0.18em] text-[#ff4eb7] drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
              {subtitleText}
            </p>
          ) : null}
        </div>
      </div>
    </BroadcastVideoCanvas>
  );
}

type BroadcastPresentationSlateProps = {
  headerText: string;
  bodyText?: string | null;
  logoUrl?: string | null;
  className?: string;
};

export function BroadcastPresentationSlate({
  headerText,
  bodyText,
  logoUrl,
  className = "",
}: BroadcastPresentationSlateProps) {
  return (
    <BroadcastVideoCanvas className={className}>
      <div className="absolute inset-0 bg-black/66 backdrop-blur-xl" />
      <div className="absolute inset-[5%] grid place-items-center px-[4%] text-center">
        <div className="max-w-[76%] rounded-[12px] border border-white/14 bg-[linear-gradient(135deg,rgba(6,12,26,0.86),rgba(13,21,45,0.78)_48%,rgba(28,8,31,0.82))] px-[5%] py-[4%] shadow-[0_26px_80px_rgba(0,0,0,0.62),0_0_42px_rgba(0,221,235,0.14)]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="mx-auto mb-[3%] max-h-28 max-w-[34%] object-contain" />
          ) : null}
          <div className="mx-auto mb-[3%] h-1.5 w-48 max-w-[40%] rounded-full bg-gradient-to-r from-[#00ddeb] via-[#1677ff] to-[#ff2faf]" />
          <h2 className="font-headline text-[clamp(1.8rem,5.2vw,7.25rem)] font-black uppercase leading-[0.9] tracking-[0.05em] text-white drop-shadow-[0_5px_20px_rgba(0,0,0,0.85)]">
            {headerText}
          </h2>
          {bodyText ? (
            <p className="mx-auto mt-[3%] max-w-[82%] font-body text-[clamp(0.95rem,1.65vw,2.35rem)] font-semibold leading-tight text-white/82 drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)]">
              {bodyText}
            </p>
          ) : null}
        </div>
      </div>
    </BroadcastVideoCanvas>
  );
}
