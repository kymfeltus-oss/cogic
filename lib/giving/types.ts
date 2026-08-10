export type GivingFundKey = string;

export type GivingFund = {
  id?: string;
  key: GivingFundKey;
  label: string;
  description: string;
  active: boolean;
  published?: boolean;
  sortOrder: number;
};

export type GivingPaymentMethodId = "card" | "apple_pay" | "ach";

export type GivingSourceType =
  | "cogic_giving"
  | "live"
  | "replay"
  | "event"
  | "collection"
  | "experience";

export type GivingCheckoutRequest = {
  amountInCents: number;
  fundKey: GivingFundKey;
  note?: string;
  frequency?: "one_time";
  source?: string;
  paymentMethod?: GivingPaymentMethodId;
  sourceType?: GivingSourceType;
  mediaId?: string;
  eventId?: string;
  eventOccurrenceId?: string;
  collectionId?: string;
  programKey?: string;
};
