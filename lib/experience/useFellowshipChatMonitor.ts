"use client";

import { useAttendeeChatRealtime } from "@/lib/experience/useAttendeeChatRealtime";

type UseFellowshipChatMonitorOptions = {
  enabled?: boolean;
};

/** @deprecated Prefer `useAttendeeChatRealtime` — thin wrapper for legacy imports. */
export function useFellowshipChatMonitor(options: UseFellowshipChatMonitorOptions = {}) {
  return useAttendeeChatRealtime(options);
}
