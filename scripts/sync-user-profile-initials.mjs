/**
 * Backfill attendee first/last names from Supabase auth user_metadata.
 * Run after applying migration 20260612120000_attendee_profile_names.sql.
 *
 * Usage: npm run sync:profile-initials
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizeNamePart(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function parseNameFields(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: normalizeNamePart(metadata.first_name ?? metadata.firstName),
    lastName: normalizeNamePart(metadata.last_name ?? metadata.lastName),
  };
}

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < perPage) break;
    page += 1;
  }

  return users;
}

async function main() {
  const users = await listAllAuthUsers();
  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const { firstName, lastName } = parseNameFields(user.user_metadata);
    if (!firstName && !lastName) {
      skipped += 1;
      continue;
    }

    const { error } = await admin
      .from("attendees")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
      })
      .eq("id", user.id);

    if (error) {
      console.error(`Failed to sync ${user.id}: ${error.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(
    `Profile sync complete. Updated ${updated} attendee row(s), skipped ${skipped} user(s) without names.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
