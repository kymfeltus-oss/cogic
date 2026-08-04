"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FellowshipChatMessage, FellowshipChatSession } from "@/lib/experience/fellowship-chat";
import { useFellowshipChat } from "@/lib/experience/useFellowshipChat";

type IgLiveChatContextValue = {
  messages: FellowshipChatMessage[];
  session: FellowshipChatSession;
  isSending: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<boolean>;
  clearError: () => void;
};

const IgLiveChatContext = createContext<IgLiveChatContextValue | null>(null);

export function IgLiveChatProvider({ children }: { children: ReactNode }) {
  const { messages, session, isSending, error, sendMessage, clearError } = useFellowshipChat();

  return (
    <IgLiveChatContext.Provider
      value={{ messages, session, isSending, error, sendMessage, clearError }}
    >
      {children}
    </IgLiveChatContext.Provider>
  );
}

export function useIgLiveChat(): IgLiveChatContextValue {
  const context = useContext(IgLiveChatContext);
  if (!context) {
    throw new Error("useIgLiveChat must be used within IgLiveChatProvider");
  }
  return context;
}
