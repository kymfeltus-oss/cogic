import {
  isLivePollChoice,
  mapLivePollRow,
  type LivePollChoice,
  type LivePollPayload,
  type LivePollPublic,
  type LivePollRow,
  type LivePollTotals,
} from "@/lib/experience/polls";
import type { SupabaseClient } from "@supabase/supabase-js";

const POLL_SELECT =
  "id, question, option_a, option_b, is_active, created_at" as const;

export async function loadActivePollRow(
  admin: SupabaseClient,
): Promise<LivePollRow | null> {
  const { data, error } = await admin
    .from("live_polls")
    .select(POLL_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Active poll load failed:", error.message);
    return null;
  }

  return (data as LivePollRow | null) ?? null;
}

export async function computePollTotals(
  admin: SupabaseClient,
  pollId: string,
): Promise<LivePollTotals> {
  const [aResult, bResult] = await Promise.all([
    admin
      .from("live_poll_votes")
      .select("*", { count: "exact", head: true })
      .eq("poll_id", pollId)
      .eq("vote_choice", "A"),
    admin
      .from("live_poll_votes")
      .select("*", { count: "exact", head: true })
      .eq("poll_id", pollId)
      .eq("vote_choice", "B"),
  ]);

  if (aResult.error) {
    console.error("Poll totals (A) failed:", aResult.error.message);
  }
  if (bResult.error) {
    console.error("Poll totals (B) failed:", bResult.error.message);
  }

  return {
    countA: aResult.count ?? 0,
    countB: bResult.count ?? 0,
  };
}

export async function loadUserPollVote(
  admin: SupabaseClient,
  pollId: string,
  userId: string,
): Promise<LivePollChoice | null> {
  const { data, error } = await admin
    .from("live_poll_votes")
    .select("vote_choice")
    .eq("poll_id", pollId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("User poll vote load failed:", error.message);
    return null;
  }

  const choice = data?.vote_choice;
  return isLivePollChoice(choice) ? choice : null;
}

export async function buildLivePollPayload(
  admin: SupabaseClient,
  userId: string | null,
): Promise<LivePollPayload> {
  const active = await loadActivePollRow(admin);

  if (!active) {
    return {
      poll: null,
      totals: { countA: 0, countB: 0 },
      userVote: null,
      session: {
        authenticated: Boolean(userId),
        canVote: false,
      },
    };
  }

  const [totals, userVote] = await Promise.all([
    computePollTotals(admin, active.id),
    userId ? loadUserPollVote(admin, active.id, userId) : Promise.resolve(null),
  ]);

  return {
    poll: mapLivePollRow(active),
    totals,
    userVote,
    session: {
      authenticated: Boolean(userId),
      canVote: Boolean(userId) && userVote === null,
    },
  };
}

export async function assertPollAcceptsVote(
  admin: SupabaseClient,
  pollId: string,
  choice: LivePollChoice,
): Promise<{ ok: true; poll: LivePollPublic } | { ok: false; error: string; status: number }> {
  if (!isLivePollChoice(choice)) {
    return { ok: false, error: "Invalid vote choice.", status: 400 };
  }

  const { data, error } = await admin
    .from("live_polls")
    .select(POLL_SELECT)
    .eq("id", pollId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Poll not found.", status: 404 };
  }

  const row = data as LivePollRow;
  if (!row.is_active) {
    return { ok: false, error: "This poll is no longer active.", status: 409 };
  }

  return { ok: true, poll: mapLivePollRow(row) };
}

export type CreatePollInput = {
  question: string;
  optionA: string;
  optionB: string;
  activate?: boolean;
};

export function validateCreatePollInput(
  body: Record<string, unknown>,
): { ok: true; input: CreatePollInput } | { ok: false; error: string } {
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const optionA = typeof body.option_a === "string" ? body.option_a.trim() : "";
  const optionB = typeof body.option_b === "string" ? body.option_b.trim() : "";

  if (!question || question.length > 280) {
    return { ok: false, error: "Question must be between 1 and 280 characters." };
  }
  if (!optionA || optionA.length > 120) {
    return { ok: false, error: "Option A must be between 1 and 120 characters." };
  }
  if (!optionB || optionB.length > 120) {
    return { ok: false, error: "Option B must be between 1 and 120 characters." };
  }

  return {
    ok: true,
    input: {
      question,
      optionA,
      optionB,
      activate: body.activate === true,
    },
  };
}

export async function createLivePoll(
  admin: SupabaseClient,
  input: CreatePollInput,
): Promise<LivePollRow> {
  if (input.activate) {
    await admin.from("live_polls").update({ is_active: false }).eq("is_active", true);
  }

  const { data, error } = await admin
    .from("live_polls")
    .insert({
      question: input.question,
      option_a: input.optionA,
      option_b: input.optionB,
      is_active: input.activate ?? false,
    })
    .select(POLL_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create poll.");
  }

  return data as LivePollRow;
}

export async function setLivePollActive(
  admin: SupabaseClient,
  pollId: string,
  isActive: boolean,
): Promise<LivePollRow | null> {
  if (isActive) {
    await admin.from("live_polls").update({ is_active: false }).eq("is_active", true);
  }

  const { data, error } = await admin
    .from("live_polls")
    .update({ is_active: isActive })
    .eq("id", pollId)
    .select(POLL_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as LivePollRow | null) ?? null;
}

export async function listLivePolls(admin: SupabaseClient): Promise<LivePollRow[]> {
  const { data, error } = await admin
    .from("live_polls")
    .select(POLL_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data as LivePollRow[]) ?? [];
}
