"use client";

import { useCallback } from "react";
import type { FellowshipChatMessage } from "@/lib/experience/fellowship-chat";
import { useAttendeeChatRealtime } from "@/lib/experience/useAttendeeChatRealtime";

type UseCountdownChatTroubleAlertsOptions = {
  enabled?: boolean;
};

type UseCountdownChatTroubleAlertsResult = {
  messages: FellowshipChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
  issueType: null;
  count: number;
  audioCount: number;
  videoCount: number;
  clear: () => void;
};

export function useCountdownChatTroubleAlerts(
  options: UseCountdownChatTroubleAlertsOptions = {},
): UseCountdownChatTroubleAlertsResult {
  const { enabled = true } = options;
  const { messages, isLoading, isConnected } = useAttendeeChatRealtime({ enabled });
  const clear = useCallback(() => undefined, []);

  return {
    messages,
    isLoading,
    isConnected,
    issueType: null,
    count: 0,
    audioCount: 0,
    videoCount: 0,
    clear,
  };
}
