/** Overlay layout for `/create-account` — `create-account-background.png` (941×1672). */

export type CreateAccountOverlayRect = {
  left: string;
  top: string;
  width: string;
  height: string;
};

/** Absolute slots — measured on create-account-background.png (2026 plate). */
export const CREATE_ACCOUNT_FIELD_SLOTS = {
  /** Invisible tap target over PNG upload circle + label (not a native UI layer). */
  avatar: { left: "34%", top: "29.5%", width: "32%", height: "12%" },
  fullName: { left: "14.5%", top: "45%", width: "71%", height: "5.4%" },
  email: { left: "14.5%", top: "50.8%", width: "71%", height: "5.2%" },
  city: { left: "14.5%", top: "56.4%", width: "71%", height: "5.2%" },
  state: { left: "14.5%", top: "62%", width: "71%", height: "5.2%" },
  password: { left: "14.5%", top: "67.6%", width: "71%", height: "5.2%" },
  confirmPassword: { left: "14.5%", top: "73.2%", width: "71%", height: "5.2%" },
  terms: { left: "14.5%", top: "79.4%", width: "71%", height: "2.8%" },
  submit: { left: "14.5%", top: "82.8%", width: "71%", height: "5.5%" },
  loginLink: { left: "14.5%", top: "90.1%", width: "71%", height: "3%" },
} as const satisfies Record<string, CreateAccountOverlayRect>;

/** Per-field black masks — hides baked rows only; upload photo PNG stays visible. */
export const CREATE_ACCOUNT_BAKED_FIELD_MASKS: CreateAccountOverlayRect[] = [
  CREATE_ACCOUNT_FIELD_SLOTS.fullName,
  CREATE_ACCOUNT_FIELD_SLOTS.email,
  CREATE_ACCOUNT_FIELD_SLOTS.city,
  CREATE_ACCOUNT_FIELD_SLOTS.state,
  CREATE_ACCOUNT_FIELD_SLOTS.password,
  CREATE_ACCOUNT_FIELD_SLOTS.confirmPassword,
  CREATE_ACCOUNT_FIELD_SLOTS.terms,
  CREATE_ACCOUNT_FIELD_SLOTS.submit,
  CREATE_ACCOUNT_FIELD_SLOTS.loginLink,
];

/** @deprecated Use CREATE_ACCOUNT_BAKED_FIELD_MASKS. */
export const CREATE_ACCOUNT_BAKED_FORM_MASK: CreateAccountOverlayRect = {
  left: "0%",
  top: "44.5%",
  width: "100%",
  height: "48%",
};

/** @deprecated Flex panel — use CREATE_ACCOUNT_FIELD_SLOTS. */
export const CREATE_ACCOUNT_FORM_PANEL: CreateAccountOverlayRect = {
  left: "0%",
  top: "0%",
  width: "100%",
  height: "100%",
};
