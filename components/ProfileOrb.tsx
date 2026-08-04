"use client";

import { type ButtonHTMLAttributes, type CSSProperties } from "react";
import { BRAND_GRADIENTS } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export type ProfileOrbSize = "sm" | "md" | "lg";

const SIZE_PX: Record<ProfileOrbSize, number> = {
  sm: 44,
  md: 52,
  lg: 64,
};

export type ProfileOrbProps = {
  /** One or two uppercase initials shown in the orb center. */
  initials: string;
  /** Optional uploaded profile photo rendered inside the orb. */
  avatarUrl?: string | null;
  /** Preset or explicit pixel diameter (minimum 44 for touch). */
  size?: ProfileOrbSize | number;
  /** Selected / focused identity state. */
  active?: boolean;
  /** Shows a small glowing notification dot. */
  hasNotification?: boolean;
  className?: string;
} & Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "aria-label" | "aria-pressed" | "disabled" | "type"
>;

function normalizeInitials(initials: string): string {
  const trimmed = initials.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2).toUpperCase();
}

function ProfileOrbContent({
  initials,
  avatarUrl,
  hasNotification,
}: {
  initials: string;
  avatarUrl?: string | null;
  hasNotification: boolean;
}) {
  return (
    <>
      <span className="profile-orb-surface">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="profile-orb-avatar"
            decoding="async"
          />
        ) : (
          <span className="profile-orb-initials font-ui" aria-hidden>
            {normalizeInitials(initials)}
          </span>
        )}
        <span className="profile-orb-reflection" aria-hidden />
      </span>

      {hasNotification ? (
        <span className="profile-orb-notification" aria-hidden>
          <span className="profile-orb-notification-core" />
        </span>
      ) : null}
    </>
  );
}

export default function ProfileOrb({
  initials,
  avatarUrl = null,
  size = "md",
  active = false,
  hasNotification = false,
  className,
  onClick,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  disabled,
  type = "button",
}: ProfileOrbProps) {
  const diameter = typeof size === "number" ? Math.max(44, size) : SIZE_PX[size];
  const label = ariaLabel ?? `Profile ${normalizeInitials(initials)}`;

  const orbStyle = {
    width: diameter,
    height: diameter,
    background: BRAND_GRADIENTS.ring,
    "--profile-orb-size": `${diameter}px`,
  } as CSSProperties;

  const sharedClassName = cn(
    "profile-orb touch-target",
    active && "profile-orb--active",
    hasNotification && "profile-orb--has-notification",
    onClick && "profile-orb--interactive",
    className,
  );

  if (onClick) {
    return (
      <button
        type={type}
        className={sharedClassName}
        style={orbStyle}
        onClick={onClick}
        aria-label={label}
        aria-pressed={active ? true : ariaPressed}
        disabled={disabled}
      >
        <ProfileOrbContent
          initials={initials}
          avatarUrl={avatarUrl}
          hasNotification={hasNotification}
        />
      </button>
    );
  }

  return (
    <div className={sharedClassName} style={orbStyle} role="img" aria-label={label}>
      <ProfileOrbContent
        initials={initials}
        avatarUrl={avatarUrl}
        hasNotification={hasNotification}
      />
    </div>
  );
}
