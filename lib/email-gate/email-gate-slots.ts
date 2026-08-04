export type EmailGateActionSlot = {
  id: "attendee" | "team";
  label: string;
  left: string;
  top: string;
  width: string;
  height: string;
};

/** Percentage hit targets on email-gate-background.png (853×1844). */
export const EMAIL_GATE_ACTION_SLOTS: readonly EmailGateActionSlot[] = [
  {
    id: "attendee",
    label: "Attendee — log in or create account",
    left: "6.9%",
    top: "48.5%",
    width: "86.2%",
    height: "4.1%",
  },
  {
    id: "team",
    label: "Team login",
    left: "6.9%",
    top: "56.1%",
    width: "86.3%",
    height: "5.5%",
  },
] as const;
