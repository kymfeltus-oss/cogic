import type {
  RealtimeChannel,
  SupabaseClient,
} from "@supabase/supabase-js";

let channelSequence = 0;

type PostgresChangePayload = {
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

export type PostgresBinding = {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema: string;
  table: string;
  callback: (payload: PostgresChangePayload) => void;
};

export type BroadcastBinding = {
  event: string;
  callback: (payload: { payload: unknown }) => void;
};

export type RealtimeBindings = {
  postgres?: PostgresBinding[];
  broadcast?: BroadcastBinding[];
};

export type RealtimeChannelOptions = {
  broadcast?: {
    self?: boolean;
    ack?: boolean;
  };
};

export type RealtimeSubscribeHandler = (
  status: string,
  err?: Error,
) => void;

const REALTIME_LOG_PREFIX = "[Supabase Realtime]";

/** Dev-visible subscription status — surfaces CHANNEL_ERROR / TIMED_OUT instead of failing silently. */
export function logRealtimeSubscribeStatus(
  channelLabel: string,
  status: string,
  err?: Error,
): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`${REALTIME_LOG_PREFIX} ${channelLabel} status: ${status}`);
    if (err) {
      console.error(`${REALTIME_LOG_PREFIX} ${channelLabel} error:`, err);
    }
  }
}

function channelTopic(channelName: string): string {
  return `realtime:${channelName}`;
}

/** Namespaced channel id safe for React Strict Mode remounts. */
export function buildChannelName(base: string, instanceId: string): string {
  channelSequence += 1;
  return `${base}--${instanceId}--${channelSequence}`;
}

/** Remove any existing client channels that share the target topic. */
export async function removeChannelsByName(
  supabase: SupabaseClient,
  channelName: string,
): Promise<void> {
  const topic = channelTopic(channelName);
  const stale = supabase.getChannels().filter((channel) => channel.topic === topic);

  await Promise.all(stale.map((channel) => supabase.removeChannel(channel)));
}

/** Awaitable teardown for effect cleanup paths. */
export async function teardownRealtimeChannel(
  supabase: SupabaseClient,
  channel: RealtimeChannel | null,
): Promise<void> {
  if (!channel) return;
  await supabase.removeChannel(channel);
}

/**
 * Create a realtime channel with all listeners bound before subscribe().
 * Clears stale channels first to avoid Strict Mode subscribe races.
 */
export async function createRealtimeChannel(
  supabase: SupabaseClient,
  channelName: string,
  bindings: RealtimeBindings,
  onSubscribe?: RealtimeSubscribeHandler,
  channelOptions?: RealtimeChannelOptions,
): Promise<RealtimeChannel> {
  await removeChannelsByName(supabase, channelName);

  let channel = supabase.channel(
    channelName,
    channelOptions ? { config: { broadcast: channelOptions.broadcast } } : undefined,
  );

  for (const binding of bindings.postgres ?? []) {
    channel = channel.on(
      "postgres_changes",
      {
        event: binding.event,
        schema: binding.schema,
        table: binding.table,
      },
      binding.callback,
    );
  }

  for (const binding of bindings.broadcast ?? []) {
    channel = channel.on("broadcast", { event: binding.event }, binding.callback);
  }

  channel.subscribe((status, err) => {
    logRealtimeSubscribeStatus(channelName, status, err);
    onSubscribe?.(status, err);
  });

  return channel;
}
