/** Overlay layout for `/login` — `auth-attendee-login.png` (941×1672) on 1080×1920 stage. */

export type LoginOverlayRect = {
  left: string;
  top: string;
  width: string;
  height: string;
};

function slot(left: number, top: number, width: number, height: number): LoginOverlayRect {
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

/** Absolute slots — measured on auth-attendee-login.png. */
export const LOGIN_FIELD_SLOTS = {
  email: slot(15, 54.0, 70, 4.8),
  password: slot(15, 58.9, 70, 4.8),
  options: slot(15, 62.5, 69, 3.2),
  submit: slot(15, 66.5, 70, 4.5),
  socialRow: slot(14, 70.9, 72, 5.5),
  signUp: slot(10, 79.0, 80, 4.5),
} as const satisfies Record<string, LoginOverlayRect>;

/** Hides baked PNG rows — live inputs and links sit on top. Submit/social keep PNG art visible. */
export const LOGIN_BAKED_FIELD_MASKS: LoginOverlayRect[] = [
  LOGIN_FIELD_SLOTS.email,
  LOGIN_FIELD_SLOTS.password,
  LOGIN_FIELD_SLOTS.options,
  LOGIN_FIELD_SLOTS.signUp,
];

/** @deprecated Use LOGIN_BAKED_FIELD_MASKS. */
export const LOGIN_BAKED_FORM_MASK: LoginOverlayRect = {
  left: "0%",
  top: "53%",
  width: "100%",
  height: "32%",
};

/** @deprecated Flex panel — use LOGIN_FIELD_SLOTS. */
export const LOGIN_FORM_PANEL: LoginOverlayRect = {
  left: "0%",
  top: "0%",
  width: "100%",
  height: "100%",
};
