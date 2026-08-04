/**
 * Phase 4D — create two non-privileged Auth test users on wjlaalu.
 * Prints only ids/emails (no passwords, no secrets).
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

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
  const p = jwt.split(".")[1];
  const j = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  return j.ref;
}

const env = loadEnv();
const target = "wjlaaluonxiaxmytiqwi";
const svcRef = refFromJwt(env.SUPABASE_SERVICE_ROLE_KEY);
if (svcRef !== target) {
  console.error("REFUSE: service role is not wjlaalu");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const password = `P4d!${randomBytes(12).toString("base64url")}`;
const users = [
  {
    label: "A",
    email: `phase4d.user.a.${stamp}@cogic-stream.test`,
  },
  {
    label: "B",
    email: `phase4d.user.b.${stamp}@cogic-stream.test`,
  },
];

const created = [];
for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: `Phase4D${u.label}`,
      last_name: "Verifier",
      full_name: `Phase4D${u.label} Verifier`,
    },
    app_metadata: {
      // Explicitly non-privileged — no admin/owner/finance/broadcaster/moderator
      role: "attendee",
    },
  });
  if (error) {
    console.error(`CREATE_USER_${u.label}_FAIL`, error.message);
    process.exit(1);
  }
  created.push({ label: u.label, id: data.user.id, email: u.email });
}

// Write credentials to a gitignored local file for browser login (not printed).
const outPath = new URL("../.phase4d-credentials.local.json", import.meta.url);
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      projectRef: target,
      password,
      users: created,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log("TEST_USERS_CREATED");
for (const u of created) {
  console.log(`USER_${u.label}_ID ${u.id}`);
  console.log(`USER_${u.label}_EMAIL ${u.email}`);
}
console.log("CREDENTIALS_FILE .phase4d-credentials.local.json");
console.log("PRIVILEGES non-privileged attendee only");
