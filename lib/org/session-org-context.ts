import "server-only";

import { getUserFromSession } from "@/lib/auth/session";
import { isApplicationOwnerEmail } from "@/lib/access/admin-prep-override";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type ChurchOrgRole = "Pastor" | "Overseer" | "Traveler";

export interface ChurchOrgContext {
  userId: string;
  email: string;
  churchId: string | null;
  churchName: string | null;
  role: "Pastor" | "Overseer" | "Traveler";
  isPlatformOwner: boolean;
}

type MembershipLookupRow = {
  role: string | null;
  church_id: string | null;
  updated_at: string | null;
  church_organizations:
    | { id: string; name: string | null }
    | { id: string; name: string | null }[]
    | null;
};

const ROLE_PRIORITY: Record<ChurchOrgRole, number> = {
  Pastor: 3,
  Overseer: 2,
  Traveler: 1,
};

function asChurchOrgRole(value: string | null | undefined): ChurchOrgRole | null {
  if (value === "Pastor" || value === "Overseer" || value === "Traveler") {
    return value;
  }
  return null;
}

function organizationFromRow(
  value: MembershipLookupRow["church_organizations"],
): { id: string; name: string | null } | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function pickActiveMembership(rows: MembershipLookupRow[]): {
  churchId: string;
  churchName: string | null;
  role: ChurchOrgRole;
} | null {
  const ranked: Array<{
    churchId: string;
    churchName: string | null;
    role: ChurchOrgRole;
    updatedAt: number;
  }> = [];

  for (const row of rows) {
    const role = asChurchOrgRole(row.role);
    const organization = organizationFromRow(row.church_organizations);
    const churchId = organization?.id ?? row.church_id;
    if (!role || !churchId) {
      continue;
    }
    ranked.push({
      churchId,
      churchName: organization?.name?.trim() || null,
      role,
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : 0,
    });
  }

  if (ranked.length === 0) {
    return null;
  }

  ranked.sort((left, right) => {
    const roleDelta = ROLE_PRIORITY[right.role] - ROLE_PRIORITY[left.role];
    if (roleDelta !== 0) {
      return roleDelta;
    }
    return right.updatedAt - left.updatedAt;
  });

  const active = ranked[0];
  return {
    churchId: active.churchId,
    churchName: active.churchName,
    role: active.role,
  };
}

/**
 * Server-authoritative church affiliation + role context.
 * Identity comes only from verified Supabase auth cookies via getUserFromSession().
 * Never trusts request body/query for userId, churchId, or role.
 *
 * isPlatformOwner is evaluated from process.env.ADMIN_EMAILS only (comma-separated).
 * Request is accepted for route-handler signature compatibility; privilege inputs are
 * never read from it — Next SSR cookies are the sole auth source.
 */
export async function resolveServerOrgContext(
  _req: Request,
): Promise<ChurchOrgContext | null> {
  // getUserFromSession() has no Request arg in this codebase; cookies are read via SSR client.
  const user = await getUserFromSession();
  const userId = user?.id?.trim() ?? "";
  const email = user?.email?.trim().toLowerCase() ?? "";

  if (!userId || !email) {
    return null;
  }

  // Server-authoritative application owner evaluation (ADMIN_EMAILS allowlist).
  const isPlatformOwner = isApplicationOwnerEmail(email);

  const { data, error } = await getSupabaseAdmin()
    .from("church_memberships")
    .select("role,church_id,updated_at,church_organizations(id,name)")
    .eq("user_id", userId);

  if (error) {
    console.error("[org.session] church_memberships lookup failed", {
      code: error.code,
      message: error.message,
    });
    return {
      userId,
      email,
      churchId: null,
      churchName: null,
      role: "Traveler",
      isPlatformOwner,
    };
  }

  const active = pickActiveMembership((data ?? []) as MembershipLookupRow[]);
  if (!active) {
    return {
      userId,
      email,
      churchId: null,
      churchName: null,
      role: "Traveler",
      isPlatformOwner,
    };
  }

  return {
    userId,
    email,
    churchId: active.churchId,
    churchName: active.churchName,
    role: active.role,
    isPlatformOwner,
  };
}
