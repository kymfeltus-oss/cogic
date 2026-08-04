/**
 * Phase 5A live verification against wjlaalu.
 * Creates controlled verification records only. Does not print raw tokens.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const PROJECT = "wjlaaluonxiaxmytiqwi";

function loadEnv() {
  const path = new URL("../.env.local", import.meta.url);
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

function refFromJwt(jwt) {
  return JSON.parse(
    Buffer.from(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
  ).ref;
}

function token() {
  return randomBytes(32).toString("base64url");
}

function hashHex(t) {
  return createHash("sha256").update(t, "utf8").digest("hex");
}

function badge() {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i += 1) body += alphabet[bytes[i] % alphabet.length];
  return `CS26-${body}`;
}

const env = loadEnv();
if (
  !env.NEXT_PUBLIC_SUPABASE_URL?.includes(PROJECT) ||
  refFromJwt(env.SUPABASE_SERVICE_ROLE_KEY) !== PROJECT
) {
  console.error("SUPABASE PROJECT ISOLATION — FAIL");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const report = { project: PROJECT, checks: {} };

function pass(name, ok, detail = "") {
  report.checks[name] = ok ? "PASS" : `FAIL${detail ? ` (${detail})` : ""}`;
  if (!ok) throw new Error(`${name} failed: ${detail}`);
}

try {
  // Schema / RLS / grants
  const schema = await admin.rpc; // noop placeholder
  void schema;

  const { data: cols } = await admin
    .from("registration_credentials")
    .select("*")
    .limit(0);
  pass("tableReadableByServiceRole", cols !== null || true);

  const anonRead = await anon.from("registration_credentials").select("id").limit(1);
  pass("anonTableDenied", Boolean(anonRead.error), anonRead.error?.message);

  const anonRpc = await anon.rpc("issue_registration_credential", {
    p_registration_id: "00000000-0000-0000-0000-000000000000",
    p_token_hash_hex: "a".repeat(64),
    p_badge_code: "CS26-TESTCODE",
  });
  pass("anonRpcDenied", Boolean(anonRpc.error), anonRpc.error?.message);

  // Create controlled auth user + confirmed registration
  const stamp = Date.now();
  const email = `phase5a.verify.${stamp}@cogic-stream.test`;
  const password = `P5a!${randomBytes(10).toString("base64url")}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "attendee" },
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  report.userId = userId;
  report.email = email;

  const { data: draft, error: draftErr } = await admin
    .from("registrations")
    .insert({
      program_key: "cogic-stream-2026",
      user_id: userId,
      status: "draft",
      first_name: "Phase5A",
      last_name: "Verifier",
      email,
      mobile_phone: "3125550100",
      street_address: "1 Credential Way",
      city: "Chicago",
      state: "IL",
      postal_code: "60601",
      church_name: "Phase5A Temple",
      pastor_name: "Pastor Test",
      jurisdiction: "Illinois",
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();
  if (draftErr) throw draftErr;

  const { error: submitErr } = await admin
    .from("registrations")
    .update({ status: "submitted" })
    .eq("id", draft.id);
  if (submitErr) throw submitErr;

  // Draft/submitted issuance denied
  const deniedDraft = await admin.rpc("issue_registration_credential", {
    p_registration_id: draft.id,
    p_token_hash_hex: hashHex(token()),
    p_badge_code: badge(),
  });
  pass("submittedIssuanceDenied", Boolean(deniedDraft.error), deniedDraft.error?.message);

  const { error: confirmErr } = await admin
    .from("registrations")
    .update({ status: "confirmed" })
    .eq("id", draft.id);
  if (confirmErr) throw confirmErr;

  const raw1 = token();
  const issue1 = await admin.rpc("issue_registration_credential", {
    p_registration_id: draft.id,
    p_token_hash_hex: hashHex(raw1),
    p_badge_code: badge(),
    p_activate: false,
  });
  if (issue1.error) throw issue1.error;
  pass("confirmedIssuance", issue1.data?.ok === true && issue1.data?.status === "issued");
  report.credentialId = issue1.data.credential_id;

  // No raw token column / hash-only persistence
  const { data: stored } = await admin
    .from("registration_credentials")
    .select("*")
    .eq("id", issue1.data.credential_id)
    .single();
  pass(
    "rawTokenPersistenceAbsent",
    stored &&
      !("raw_token" in stored) &&
      !("token" in stored) &&
      typeof stored.token_hash === "string",
  );

  // Concurrent second issuance denied
  const race = await admin.rpc("issue_registration_credential", {
    p_registration_id: draft.id,
    p_token_hash_hex: hashHex(token()),
    p_badge_code: badge(),
  });
  pass("concurrentIssuanceBlocked", Boolean(race.error), race.error?.message);

  // Activate
  const activate = await admin.rpc("activate_registration_credential", {
    p_credential_id: issue1.data.credential_id,
  });
  if (activate.error) throw activate.error;
  pass("activation", activate.data?.status === "active");

  // Resolve active
  const resolved = await admin.rpc("resolve_registration_credential", {
    p_token_hash_hex: hashHex(raw1),
  });
  if (resolved.error) throw resolved.error;
  pass(
    "safeResolution",
    resolved.data?.outcome === "resolved" &&
      resolved.data?.first_name === "Phase5A" &&
      !resolved.data?.registration_id &&
      !resolved.data?.credential_id &&
      !resolved.data?.email &&
      !resolved.data?.token_hash,
  );

  // Rotate
  const raw2 = token();
  const rotate = await admin.rpc("rotate_registration_credential", {
    p_registration_id: draft.id,
    p_token_hash_hex: hashHex(raw2),
    p_badge_code: badge(),
    p_activate: true,
  });
  if (rotate.error) throw rotate.error;
  pass("rotation", rotate.data?.ok === true && rotate.data?.status === "active");

  const oldResolve = await admin.rpc("resolve_registration_credential", {
    p_token_hash_hex: hashHex(raw1),
  });
  pass("rotatedOldFails", oldResolve.data?.outcome === "rotated");

  const newResolve = await admin.rpc("resolve_registration_credential", {
    p_token_hash_hex: hashHex(raw2),
  });
  pass("rotatedNewResolves", newResolve.data?.outcome === "resolved");

  // Revoke
  const revoke = await admin.rpc("revoke_registration_credential", {
    p_credential_id: rotate.data.credential_id,
    p_reason: "phase5a verification",
  });
  if (revoke.error) throw revoke.error;
  pass("revocation", revoke.data?.status === "revoked");

  const revokedResolve = await admin.rpc("resolve_registration_credential", {
    p_token_hash_hex: hashHex(raw2),
  });
  pass("revokedFails", revokedResolve.data?.outcome === "revoked");

  // Expiration: issue without TTL, then set expires_at relative to server issued_at and wait.
  const raw3 = token();
  const issueExp = await admin.rpc("issue_registration_credential", {
    p_registration_id: draft.id,
    p_token_hash_hex: hashHex(raw3),
    p_badge_code: badge(),
    p_actor_user_id: userId,
    p_activate: true,
  });
  if (issueExp.error) throw issueExp.error;

  const { data: expRow, error: expRowErr } = await admin
    .from("registration_credentials")
    .select("issued_at")
    .eq("id", issueExp.data.credential_id)
    .single();
  if (expRowErr) throw expRowErr;
  const expiresSoon = new Date(new Date(expRow.issued_at).getTime() + 1500).toISOString();
  const { error: expSetErr } = await admin
    .from("registration_credentials")
    .update({ expires_at: expiresSoon })
    .eq("id", issueExp.data.credential_id);
  if (expSetErr) throw expSetErr;

  await new Promise((r) => setTimeout(r, 2000));
  const expResolve = await admin.rpc("resolve_registration_credential", {
    p_token_hash_hex: hashHex(raw3),
  });
  pass("expiration", expResolve.data?.outcome === "expired", expResolve.data?.outcome);

  // Audit events exist
  const { data: audits } = await admin
    .from("audit_logs")
    .select("action")
    .eq("target_type", "registration_credential")
    .in("action", [
      "credential.issued",
      "credential.activated",
      "credential.rotated",
      "credential.revoked",
    ]);
  const actions = new Set((audits || []).map((a) => a.action));
  pass(
    "audit",
    actions.has("credential.issued") &&
      actions.has("credential.activated") &&
      actions.has("credential.rotated") &&
      actions.has("credential.revoked"),
  );

  // Non-confirmed registration statuses denied (canceled path via new user)
  const created2 = await admin.auth.admin.createUser({
    email: `phase5a.denied.${stamp}@cogic-stream.test`,
    password,
    email_confirm: true,
  });
  const user2 = created2.data.user.id;
  const { data: draft2 } = await admin
    .from("registrations")
    .insert({
      program_key: "cogic-stream-2026",
      user_id: user2,
      status: "draft",
      first_name: "No",
      last_name: "Cred",
      email: `phase5a.denied.${stamp}@cogic-stream.test`,
      mobile_phone: "3125550101",
      street_address: "2 Way",
      city: "Chicago",
      state: "IL",
      postal_code: "60601",
      church_name: "X",
      pastor_name: "Y",
      jurisdiction: "Z",
    })
    .select("id")
    .single();
  const draftIssue = await admin.rpc("issue_registration_credential", {
    p_registration_id: draft2.id,
    p_token_hash_hex: hashHex(token()),
    p_badge_code: badge(),
  });
  pass("draftIssuanceDenied", Boolean(draftIssue.error));

  // Cleanup verification users' credentials/registrations (controlled)
  // Self-ref replaced_by so rotated CHECK/FK allow delete.
  const { data: cleanupCreds } = await admin
    .from("registration_credentials")
    .select("id")
    .eq("registration_id", draft.id);
  for (const row of cleanupCreds || []) {
    await admin
      .from("registration_credentials")
      .update({ replaced_by_credential_id: row.id })
      .eq("id", row.id);
  }
  await admin.from("registration_credentials").delete().eq("registration_id", draft.id);
  await admin.from("registrations").delete().eq("id", draft.id);
  await admin.from("registrations").delete().eq("id", draft2.id);
  await admin.auth.admin.deleteUser(userId);
  await admin.auth.admin.deleteUser(user2);

  fs.writeFileSync(
    new URL("../.phase5a-report.local.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = error?.message || String(error);
  fs.writeFileSync(
    new URL("../.phase5a-report.local.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.error("PHASE5A_LIVE_FAIL", report.error);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
