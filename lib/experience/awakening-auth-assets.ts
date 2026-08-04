/** Attendee email-gate — PNG art plate + overlay slot constants. */

import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";

/** Bump when replacing PNG plates so browsers pick up new art. */
export const AWAKENING_AUTH_ASSET_VERSION = "20260622-auth-v20";

/** Same 1080×1920 stage as attendee dashboard. */
export const AWAKENING_AUTH_LOGIN_ART = MOBILE_ARTBOARD_REF;

/** Same 1080×1920 stage as attendee dashboard. */
export const AWAKENING_AUTH_SIGNUP_ART = MOBILE_ARTBOARD_REF;

/** Native pixel sizes of auth PNG plates (object-fit: contain, top-aligned). */
export const AWAKENING_AUTH_NATIVE = {
  login: { width: 941, height: 1672 },
  signup: { width: 941, height: 1672 },
} as const;

export const AWAKENING_AUTH_ASSETS = {
  attendeeLoginPlate: "/awakening/auth-attendee-login.png",
  /** Signup plate — `public/create-account/create-account-background.png` (941×1672). */
  attendeeSignupPlate: "/create-account/create-account-background.png",
} as const;

/** Sliced login controls — `public/awakening/*.png` */
export const AWAKENING_AUTH_LOGIN_COMPONENTS = {
  emailField: { src: "/awakening/email_field_full.png", width: 710, height: 97 },
  passwordField: { src: "/awakening/password_button.png", width: 332, height: 47 },
  rememberRow: { src: "/awakening/remember_me_button.png", width: 1319, height: 91 },
  loginButton: { src: "/awakening/login_button_full.png", width: 713, height: 103 },
  createAccountButton: { src: "/awakening/create_account_button_full.png", width: 714, height: 140 },
  appleButton: { src: "/awakening/apple_button.png", width: 343, height: 219 },
  googleButton: { src: "/awakening/google_button.png", width: 337, height: 220 },
  facebookButton: { src: "/awakening/facebook_button.png", width: 337, height: 220 },
  signUpFooter: { src: "/awakening/dont_have_account_button.png", width: 346, height: 29 },
} as const;

export type AuthLoginComponentKey = keyof typeof AWAKENING_AUTH_LOGIN_COMPONENTS;

export function awakeningAuthAssetUrl(path: string): string {
  return `${path}?v=${AWAKENING_AUTH_ASSET_VERSION}`;
}

export type AuthLayoutRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Flex form column anchor on the login artboard (below header plate). */
export const AWAKENING_AUTH_LOGIN_FORM = {
  left: 13.82,
  top: 46.63,
  width: 72.48,
} as const;

/** Header-only clip height — matches form anchor top (auth-attendee-login.png). */
export const AWAKENING_AUTH_LOGIN_HEADER_HEIGHT = AWAKENING_AUTH_LOGIN_FORM.top;

/** Percentage rects aligned to auth-attendee-login.png (941×1672 on 1080×1920 stage). */
export const AWAKENING_AUTH_LOGIN_PANELS = {
  email: { left: 13.82, top: 46.63, width: 72.48, height: 6.93 },
  password: { left: 13.82, top: 54.1, width: 72.49, height: 6.04 },
  rememberMe: { left: 12.54, top: 60.2, width: 6.38, height: 1.43 },
  forgotPassword: { left: 35.07, top: 60.08, width: 45.48, height: 1.43 },
  loginButton: { left: 13.82, top: 63.24, width: 72.48, height: 4.2 },
  createAccountButton: { left: 13.82, top: 71.25, width: 72.48, height: 3.8 },
  appleSignIn: { left: 8, top: 81, width: 28, height: 4.2 },
  googleSignIn: { left: 33, top: 81, width: 32, height: 4.2 },
  facebookSignIn: { left: 72, top: 81, width: 28, height: 4.2 },
  signUpLink: { left: 13.82, top: 84.88, width: 72.48, height: 4.3 },
} as const satisfies Record<string, AuthLayoutRect>;

/** Signup overlay slots — create-account-background.png (941×1672 on 1080×1920 stage). */
export const AWAKENING_AUTH_SIGNUP_PANELS = {
  avatarUpload: { left: 34, top: 29.5, width: 32, height: 12 },
  fullName: { left: 14.5, top: 41.87, width: 71, height: 7.18 },
  email: { left: 14.5, top: 49.04, width: 71, height: 5.98 },
  city: { left: 14.5, top: 55.02, width: 71, height: 5.98 },
  state: { left: 14.5, top: 61, width: 71, height: 4.78 },
  password: { left: 14.5, top: 65.79, width: 71, height: 5.98 },
  confirmPassword: { left: 14.5, top: 71.77, width: 71, height: 5.98 },
  termsCheckbox: { left: 14.5, top: 77.99, width: 8, height: 2.8 },
  submitButton: { left: 14.5, top: 80.2, width: 71, height: 4.72 },
  backToLogin: { left: 14.5, top: 88.52, width: 71, height: 4.78 },
} as const satisfies Record<string, AuthLayoutRect>;
