import type { CSSProperties, ReactNode } from "react";
import {
  AWAKENING_AUTH_ASSETS,
  AWAKENING_AUTH_LOGIN_ART,
  AWAKENING_AUTH_NATIVE,
  awakeningAuthAssetUrl,
} from "@/lib/experience/awakening-auth-assets";
import {
  MOBILE_ARTBOARD_ART_FIT,
  MOBILE_ARTBOARD_FULL_SHELL,
  MOBILE_ARTBOARD_STAGE,
  mobileArtboardStageStyle,
} from "@/lib/responsive";

type AuthArtboardSpec = {
  width: number;
  height: number;
};

type AttendeeAuthArtboardProps = {
  children: ReactNode;
  /** Background plate — defaults to attendee login PNG. */
  backgroundSrc?: string;
  /** Artboard pixel size — must match the PNG aspect ratio. */
  artboard?: AuthArtboardSpec;
  /** Native PNG dimensions for `<img width/height>` (defaults to login plate). */
  nativePlate?: AuthArtboardSpec;
  /** Login: show header plate only; form uses sliced component PNGs below. */
  loginComponentPlates?: boolean;
};

export default function AttendeeAuthArtboard({
  children,
  backgroundSrc = AWAKENING_AUTH_ASSETS.attendeeLoginPlate,
  artboard = AWAKENING_AUTH_LOGIN_ART,
  nativePlate = AWAKENING_AUTH_NATIVE.login,
  loginComponentPlates = false,
}: AttendeeAuthArtboardProps) {
  return (
    <div className={`auth-attendee-stage ${MOBILE_ARTBOARD_FULL_SHELL} min-h-0 w-full flex-1`}>
      <div
        className={`auth-attendee-artboard ${MOBILE_ARTBOARD_STAGE}${loginComponentPlates ? " auth-attendee-artboard--login-plates" : ""}`}
        style={
          mobileArtboardStageStyle({
            native: artboard,
            extra: {
              "--auth-art-w": artboard.width,
              "--auth-art-h": artboard.height,
            },
          }) as CSSProperties
        }
      >
        <div className={MOBILE_ARTBOARD_ART_FIT}>
          {loginComponentPlates ? (
            <div className="auth-attendee-login-header-plate" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={awakeningAuthAssetUrl(backgroundSrc)}
                alt=""
                width={nativePlate.width}
                height={nativePlate.height}
                className="auth-attendee-artboard__img"
                loading="eager"
                decoding="async"
                draggable={false}
              />
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={awakeningAuthAssetUrl(backgroundSrc)}
              alt=""
              width={nativePlate.width}
              height={nativePlate.height}
              className="auth-attendee-artboard__img"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          )}
          <div className="auth-attendee-overlay" aria-hidden={false}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { AuthArtboardSpec };
