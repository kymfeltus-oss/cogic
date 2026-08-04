/** Keypad-driven currency input for Vital Seed giving. */

export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "backspace";

export const KEYPAD_ROWS: readonly (readonly KeypadKey[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
] as const;

export function sanitizeAmountInput(value: string): string {
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

export function appendKeypadKey(current: string, key: KeypadKey): string {
  if (key === "backspace") {
    return current.slice(0, -1);
  }

  if (key === ".") {
    if (current.includes(".")) return current;
    return current ? `${current}.` : "0.";
  }

  const next = current === "0" ? key : `${current}${key}`;
  const sanitized = sanitizeAmountInput(next);
  const [, fraction = ""] = sanitized.split(".");

  if (fraction.length > 2) return current;
  if (sanitized.replace(".", "").length > 9) return current;

  return sanitized;
}

export function parseAmountDollars(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === ".") return null;

  const dollars = Number.parseFloat(trimmed);
  if (!Number.isFinite(dollars) || dollars <= 0) return null;

  return dollars;
}

export function formatKeypadAmountDisplay(raw: string): string {
  const dollars = parseAmountDollars(raw);
  if (dollars == null) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

export function amountToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
