import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";
import { isAdminPrepAccessOverrideEmail } from "@/lib/access/admin-prep-override";

export type OwnerAuthSuccess = {
  ok: true;
  userId: string;
  email: string;
};

export type OwnerAuthFailure = {
  ok: false;
  status: 401 | 403;
  message: string;
};

export type OwnerAuthResult = OwnerAuthSuccess | OwnerAuthFailure;

/** Server-only — gates /api/owner/* and /owner/* surfaces. */
export async function requireOwnerUser(): Promise<OwnerAuthResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return { ok: false, status: 401, message: "Sign in required." };
  }

  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email || !isAdminPrepAccessOverrideEmail(email)) {
    return { ok: false, status: 403, message: "Owner access is not authorized for this account." };
  }

  return { ok: true, userId: user.id, email };
}
