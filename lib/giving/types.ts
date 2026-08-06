export type GivingFundKey =
  | "tithes"
  | "offering"
  | "missions"
  | "general_fund";

export type GivingFund = {
  key: GivingFundKey;
  label: string;
  description: string;
  active: boolean;
  sortOrder: number;
};

export type GivingPaymentMethodId = "card" | "apple_pay" | "ach";

export type GivingCheckoutRequest = {
  amountInCents: number;
  fundKey: GivingFundKey;
  note?: string;
  frequency?: "one_time";
  source?: string;
  paymentMethod?: GivingPaymentMethodId;
};
