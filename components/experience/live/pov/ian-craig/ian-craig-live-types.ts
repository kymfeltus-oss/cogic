import type { FellowshipChatMessage } from "@/lib/experience/fellowship-chat";

export type IanCraigChatLine = {
  id: string;
  author: string;
  body: string;
  userId: string;
  kind: "comment" | "seed";
};

export type IanCraigTopSupporter = {
  name: string;
  initials: string;
  amount: number;
};

export const IAN_CRAIG_TOP_SUPPORTER: IanCraigTopSupporter = {
  name: "Sarah M.",
  initials: "SM",
  amount: 500,
};

export function mapFellowshipToIanCraigLine(message: FellowshipChatMessage): IanCraigChatLine {
  const seedPattern = /sow(ed|ing)?\s+a?\s*seed/i;
  const kind = seedPattern.test(message.body) ? "seed" : "comment";

  return {
    id: message.id,
    author: message.author,
    body: kind === "seed" ? "sowed a seed" : message.body,
    userId: message.userId,
    kind,
  };
}

export function isSeedChatContent(content: string): boolean {
  return /sow(ed|ing)?\s+a?\s*seed/i.test(content);
}
