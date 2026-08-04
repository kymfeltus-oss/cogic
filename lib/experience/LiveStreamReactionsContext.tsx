"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getLiveReactionEmoji,
  LIVE_REACTION_CLIENT_COOLDOWN_MS,
  MAX_FLOATING_LIVE_REACTIONS,
  randomReactionOriginX,
  type FloatingLiveReaction,
  type LiveReactionRow,
  type LiveReactionType,
} from "@/lib/experience/live-reactions";
import {
  buildChannelName,
  createRealtimeChannel,
  teardownRealtimeChannel,
} from "@/lib/live/realtime-subscribe";
import { getClientAppUrl } from "@/lib/client-api";
import { getSupabase } from "@/lib/supabase/client";

const LIVE_REACTIONS_CHANNEL = "live-stream-reactions";
const FLOAT_DISMISS_MS = 1_500;

type LiveStreamReactionsContextValue = {
  enabled: boolean;
  floatingReactions: FloatingLiveReaction[];
  isSending: boolean;
  sendReaction: (type: LiveReactionType) => Promise<boolean>;
};

const LiveStreamReactionsContext = createContext<LiveStreamReactionsContextValue | null>(
  null,
);

function capFloatingReactions(
  current: FloatingLiveReaction[],
  incoming: FloatingLiveReaction,
): FloatingLiveReaction[] {
  const next = [...current, incoming];
  if (next.length <= MAX_FLOATING_LIVE_REACTIONS) return next;
  return next.slice(next.length - MAX_FLOATING_LIVE_REACTIONS);
}

function useLiveStreamReactionsState(enabled: boolean): LiveStreamReactionsContextValue {
  const instanceId = useId().replace(/:/g, "");
  const channelRef = useRef<Awaited<ReturnType<typeof createRealtimeChannel>> | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastClientSendRef = useRef(0);

  const [floatingReactions, setFloatingReactions] = useState<FloatingLiveReaction[]>([]);
  const [isSending, setIsSending] = useState(false);

  const dismissReaction = useCallback((key: string) => {
    setFloatingReactions((current) => current.filter((item) => item.key !== key));
    const timer = dismissTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(key);
    }
  }, []);

  const pushFloatingReaction = useCallback(
    (row: Pick<LiveReactionRow, "id" | "reaction_type">, originX?: number) => {
      if (seenIdsRef.current.has(row.id)) return;
      seenIdsRef.current.add(row.id);

      if (seenIdsRef.current.size > 500) {
        seenIdsRef.current.clear();
        seenIdsRef.current.add(row.id);
      }

      const key = row.id;
      const burst: FloatingLiveReaction = {
        key,
        emoji: getLiveReactionEmoji(row.reaction_type),
        originX: originX ?? randomReactionOriginX(),
      };

      setFloatingReactions((current) => capFloatingReactions(current, burst));

      const timer = setTimeout(() => dismissReaction(key), FLOAT_DISMISS_MS);
      dismissTimersRef.current.set(key, timer);
    },
    [dismissReaction],
  );

  useEffect(() => {
    if (!enabled) {
      seenIdsRef.current.clear();
      queueMicrotask(() => setFloatingReactions([]));
      return;
    }

    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;
    let setupPromise: Promise<void> = Promise.resolve();

    try {
      supabase = getSupabase();
    } catch (initError) {
      console.error("Live reactions realtime init failed:", initError);
      return;
    }

    const channelName = buildChannelName(LIVE_REACTIONS_CHANNEL, instanceId);
    const dismissTimers = dismissTimersRef.current;

    setupPromise = (async () => {
      try {
        const channel = await createRealtimeChannel(supabase, channelName, {
          postgres: [
            {
              event: "INSERT",
              schema: "public",
              table: "live_stream_reactions",
              callback: (payload) => {
                const row = payload.new as LiveReactionRow;
                if (!row?.id || !row.reaction_type) return;
                pushFloatingReaction(row);
              },
            },
          ],
        });

        if (cancelled) {
          await teardownRealtimeChannel(supabase, channel);
          return;
        }

        channelRef.current = channel;
      } catch (subscribeError) {
        console.error("Live reactions subscribe failed:", subscribeError);
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        await setupPromise;
        const channel = channelRef.current;
        channelRef.current = null;
        await teardownRealtimeChannel(supabase, channel);
      })();

      for (const timer of dismissTimers.values()) {
        clearTimeout(timer);
      }
      dismissTimers.clear();
    };
  }, [enabled, instanceId, pushFloatingReaction]);

  const sendReaction = useCallback(
    async (type: LiveReactionType): Promise<boolean> => {
      if (!enabled) return false;

      const now = Date.now();
      if (now - lastClientSendRef.current < LIVE_REACTION_CLIENT_COOLDOWN_MS) {
        return false;
      }

      setIsSending(true);

      try {
        const response = await fetch(`${getClientAppUrl()}/api/experience/live-reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reactionType: type }),
        });

        const data = (await response.json()) as {
          reaction?: LiveReactionRow;
          error?: string;
        };

        if (!response.ok || !data.reaction) {
          return false;
        }

        lastClientSendRef.current = Date.now();
        pushFloatingReaction(data.reaction, randomReactionOriginX());
        return true;
      } catch (sendError) {
        console.error("Live reaction send failed:", sendError);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [enabled, pushFloatingReaction],
  );

  return {
    enabled,
    floatingReactions,
    isSending,
    sendReaction,
  };
}

export function LiveStreamReactionsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const value = useLiveStreamReactionsState(enabled);
  return (
    <LiveStreamReactionsContext.Provider value={value}>
      {children}
    </LiveStreamReactionsContext.Provider>
  );
}

export function useLiveStreamReactions(): LiveStreamReactionsContextValue {
  const context = useContext(LiveStreamReactionsContext);
  if (!context) {
    return {
      enabled: false,
      floatingReactions: [],
      isSending: false,
      sendReaction: async () => false,
    };
  }
  return context;
}
