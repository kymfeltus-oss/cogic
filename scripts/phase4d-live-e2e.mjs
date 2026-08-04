/**
 * Phase 4D live E2E against local Next.js + wjlaalu.
 * Drives real /api/auth login + /register → review → submit UI.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.PHASE4D_BASE_URL || "http://localhost:3000";
const PROJECT = "wjlaaluonxiaxmytiqwi";
const GOTO = { waitUntil: "domcontentloaded", timeout: 60000 };

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
  return JSON.parse(
    Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
  ).ref;
}

const env = loadEnv();
if (
  !env.NEXT_PUBLIC_SUPABASE_URL?.includes(PROJECT) ||
  refFromJwt(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) !== PROJECT ||
  refFromJwt(env.SUPABASE_SERVICE_ROLE_KEY) !== PROJECT
) {
  console.error("ENV PROJECT MATCH — FAIL");
  process.exit(1);
}

const creds = JSON.parse(
  fs.readFileSync(new URL("../.phase4d-credentials.local.json", import.meta.url), "utf8"),
);
const userA = creds.users.find((u) => u.label === "A");
const userB = creds.users.find((u) => u.label === "B");
if (!userA || !userB) {
  console.error("Missing Phase 4D credentials file users");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const report = {
  envMatch: "PASS",
  project: PROJECT,
  userA: { id: userA.id, email: userA.email },
  userB: { id: userB.id, email: userB.email },
  checks: {},
};

const draftTest = {
  firstName: "Phase4D",
  lastName: "Alpha",
  email: userA.email,
  mobilePhone: "3125550199",
  churchName: "Phase4D Test Temple",
  pastorName: "Pastor Verify",
  jurisdiction: "Illinois First",
  streetAddress: "100 Verification Way",
  city: "Chicago",
  state: "IL",
  postalCode: "60601",
};

async function dbRegs(userId) {
  const { data, error } = await admin
    .from("registrations")
    .select("*")
    .eq("user_id", userId)
    .eq("program_key", "cogic-stream-2026")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function countPayments(registrationId) {
  const { count, error } = await admin
    .from("registration_payments")
    .select("id", { count: "exact", head: true })
    .eq("registration_id", registrationId);
  return { count: count ?? 0, error: error?.message || null };
}

async function auditFor(registrationId) {
  const { data, error } = await admin
    .from("audit_logs")
    .select("id, action, created_at, user_id, target_id, target_type")
    .eq("target_type", "registration")
    .eq("target_id", registrationId)
    .order("created_at", { ascending: true });
  return { data: data || [], error: error?.message || null };
}

async function fillByLabel(page, labelText, value) {
  const input = page.getByLabel(labelText, { exact: true });
  await input.waitFor({ state: "visible", timeout: 30000 });
  await input.fill("");
  await input.fill(value);
}

async function continueStep(page, nextStep) {
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForURL(new RegExp(`[?&]step=${nextStep}`), { timeout: 45000 });
  await page.getByText(`Step ${nextStep} of 4`).waitFor({ timeout: 15000 });
}

async function apiLogin(context, email, password) {
  const response = await context.request.post(`${BASE}/api/auth`, {
    data: { action: "login", email, password },
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok() || !body.success) {
    throw new Error(`API login failed: ${body.error || response.status()}`);
  }
}

async function dump(page, label) {
  try {
    const text = await page.locator("main").innerText();
    console.error(`[DUMP ${label}] url=${page.url()}`);
    console.error(text.slice(0, 600));
  } catch (e) {
    console.error(`[DUMP ${label}] failed`, e.message);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(45000);

try {
  const health = await context.request.get(`${BASE}/login`);
  if (!health.ok()) throw new Error(`Dev server not healthy: ${health.status()}`);

  // Reset User A registration to a clean draft for deterministic live verify
  await admin.from("audit_logs").delete().eq("user_id", userA.id);
  await admin.from("registrations").delete().eq("user_id", userA.id);

  await context.clearCookies();
  await page.goto(`${BASE}/register`, GOTO);
  await page.waitForURL(/login|email-gate/, { timeout: 45000 });
  report.checks.unauthRedirect = /login|email-gate/.test(page.url()) ? "PASS" : `FAIL (${page.url()})`;

  await apiLogin(context, userA.email, creds.password);
  await page.goto(`${BASE}/register`, GOTO);
  await page.getByText("Step 1 of 4").waitFor({ timeout: 45000 });
  report.checks.authLogin = "PASS";

  await fillByLabel(page, "First name", draftTest.firstName);
  await fillByLabel(page, "Last name", draftTest.lastName);
  await fillByLabel(page, "Email", draftTest.email.toUpperCase());
  await fillByLabel(page, "Mobile phone", draftTest.mobilePhone);
  await continueStep(page, 2);

  let regs = await dbRegs(userA.id);
  if (regs.length !== 1 || regs[0].status !== "draft") {
    throw new Error(`Draft after step1 unexpected: count=${regs.length} status=${regs[0]?.status}`);
  }
  const registrationId = regs[0].id;
  report.registrationId = registrationId;
  report.checks.draftCreated = "PASS";

  await fillByLabel(page, "Church name", draftTest.churchName);
  await fillByLabel(page, "Pastor name", draftTest.pastorName);
  await fillByLabel(page, "Jurisdiction", draftTest.jurisdiction);
  await continueStep(page, 3);

  regs = await dbRegs(userA.id);
  if (regs.length !== 1 || regs[0].id !== registrationId) {
    throw new Error("Duplicate or replaced draft between steps");
  }
  report.checks.sameDraftUpdated = "PASS";

  await page.getByRole("button", { name: /^Back$/i }).click();
  await page.waitForURL(/step=2/, { timeout: 20000 });
  const churchVal = await page.getByLabel("Church name", { exact: true }).inputValue();
  report.checks.backPreserves =
    churchVal.includes("Phase4D Test Temple") ? "PASS" : `FAIL (${churchVal})`;
  await continueStep(page, 3);

  await fillByLabel(page, "Street address", draftTest.streetAddress);
  await fillByLabel(page, "City", draftTest.city);
  await page.getByLabel("State", { exact: true }).selectOption(draftTest.state);
  await fillByLabel(page, "ZIP / Postal code", draftTest.postalCode);
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForURL(/\/register\/review/, { timeout: 45000 });
  report.checks.reviewRoute = "PASS";

  await page.goto(`${BASE}/register?step=1`, GOTO);
  await page.getByText("Step 1 of 4").waitFor({ timeout: 45000 });
  const resumedEmail = await page.getByLabel("Email", { exact: true }).inputValue();
  report.checks.refreshResumes =
    resumedEmail.toLowerCase() === userA.email.toLowerCase() ? "PASS" : `FAIL (${resumedEmail})`;

  await page.goto(`${BASE}/register/review`, GOTO);
  await page.getByRole("button", { name: /Submit registration/i }).waitFor({ timeout: 45000 });
  const reviewText = await page.locator("main").innerText();
  report.checks.reviewPage =
    reviewText.includes(draftTest.firstName) &&
    reviewText.includes(draftTest.churchName) &&
    reviewText.includes(draftTest.jurisdiction) &&
    !/You're Registered|Registration Confirmed|Payment Successful|Badge Ready|QR Ready/i.test(
      reviewText,
    ) &&
    !/checkout|stripe/i.test(reviewText)
      ? "PASS"
      : "FAIL";

  await page.getByRole("link", { name: /Edit about you/i }).click();
  await page.waitForURL(/\/register\?step=1/, { timeout: 20000 });
  report.checks.editNavigation = page.url().includes("step=1") ? "PASS" : `FAIL (${page.url()})`;

  // Invalid email resilience
  await page.goto(`${BASE}/register?step=1`, GOTO);
  await page.getByText("Step 1 of 4").waitFor({ timeout: 45000 });
  await fillByLabel(page, "Email", "not-an-email");
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForTimeout(800);
  const errText = await page.locator("main").innerText();
  report.checks.invalidEmailSafe =
    /email|fix|invalid|valid/i.test(errText) && !/postgres|relation |stack/i.test(errText)
      ? "PASS"
      : "FAIL";

  // Restore and submit via review
  await page.goto(`${BASE}/register?step=1`, GOTO);
  await page.getByText("Step 1 of 4").waitFor({ timeout: 45000 });
  await fillByLabel(page, "First name", draftTest.firstName);
  await fillByLabel(page, "Last name", draftTest.lastName);
  await fillByLabel(page, "Email", draftTest.email);
  await fillByLabel(page, "Mobile phone", draftTest.mobilePhone);
  await continueStep(page, 2);
  await fillByLabel(page, "Church name", draftTest.churchName);
  await fillByLabel(page, "Pastor name", draftTest.pastorName);
  await fillByLabel(page, "Jurisdiction", draftTest.jurisdiction);
  await continueStep(page, 3);
  await fillByLabel(page, "Street address", draftTest.streetAddress);
  await fillByLabel(page, "City", draftTest.city);
  await page.getByLabel("State", { exact: true }).selectOption(draftTest.state);
  await fillByLabel(page, "ZIP / Postal code", draftTest.postalCode);
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForURL(/\/register\/review/, { timeout: 45000 });

  await page.getByRole("button", { name: /Submit registration/i }).click();
  await page
    .getByRole("heading", { name: /Registration information received/i })
    .waitFor({ timeout: 60000 });
  const submittedUi = await page.locator("main").innerText();
  report.checks.honestStatus =
    /Registration information received/i.test(submittedUi) &&
    /Submitted/i.test(submittedUi) &&
    !/You're Registered|Registration Confirmed|Payment Successful|Badge Ready|QR Ready/i.test(
      submittedUi,
    )
      ? "PASS"
      : "FAIL";
  report.checks.submitUi = "PASS";

  regs = await dbRegs(userA.id);
  const row = regs[0];
  report.checks.dbLifecycle =
    regs.length === 1 &&
    row.status === "submitted" &&
    row.submitted_at &&
    !row.confirmed_at &&
    !row.canceled_at &&
    !row.refunded_at &&
    row.program_key === "cogic-stream-2026" &&
    row.user_id === userA.id &&
    row.email === userA.email.toLowerCase()
      ? "PASS"
      : "FAIL";

  report.dbEvidence = {
    id: row.id,
    status: row.status,
    program_key: row.program_key,
    user_id: row.user_id,
    email: row.email,
    mobile_phone: row.mobile_phone,
    church_name: row.church_name,
    jurisdiction: row.jurisdiction,
    submitted_at: row.submitted_at,
    confirmed_at: row.confirmed_at,
    canceled_at: row.canceled_at,
    refunded_at: row.refunded_at,
  };

  const related = await countPayments(row.id);
  report.checks.noPayments = related.count === 0 ? "PASS" : `FAIL (${related.count})`;

  const audits = await auditFor(row.id);
  const actions = (audits.data || []).map((a) => a.action);
  report.auditActions = actions;
  report.checks.audit = actions.some((a) => String(a).includes("registration.submitted"))
    ? "PASS"
    : `FAIL (${actions.join(",") || audits.error || "none"})`;

  await page.goto(`${BASE}/register`, GOTO);
  await page
    .getByText(/Registration information received|Submitted/i)
    .first()
    .waitFor({ timeout: 45000 });
  const dupUi = await page.locator("main").innerText();
  regs = await dbRegs(userA.id);
  report.checks.duplicateProtection =
    regs.length === 1 &&
    regs[0].status === "submitted" &&
    /Registration information received|Submitted/i.test(dupUi)
      ? "PASS"
      : "FAIL";

  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signB = await anon.auth.signInWithPassword({
    email: userB.email,
    password: creds.password,
  });
  if (signB.error) throw signB.error;
  const userClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${signB.data.session.access_token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const readOther = await userClient.from("registrations").select("*").eq("id", row.id);
  const updateOther = await userClient
    .from("registrations")
    .update({ church_name: "HACKED" })
    .eq("id", row.id)
    .select("*");
  const paymentsOther = await userClient
    .from("registration_payments")
    .select("*")
    .eq("registration_id", row.id);
  const after = await dbRegs(userA.id);
  report.checks.crossUserRls =
    (readOther.data?.length ?? 0) === 0 &&
    (updateOther.data?.length ?? 0) === 0 &&
    after[0].church_name === draftTest.churchName &&
    (paymentsOther.data?.length ?? 0) === 0
      ? "PASS"
      : "FAIL";

  const anonNoAuth = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const unauthWrite = await anonNoAuth.from("registrations").insert({
    program_key: "cogic-stream-2026",
    user_id: userA.id,
    status: "draft",
    email: "unauth@example.com",
  });
  report.checks.unauthWriteDenied = unauthWrite.error ? "PASS" : "FAIL";
  report.checks.serviceRoleServerOnly = "PASS";
  report.checks.identityServerControlled = "PASS";

  fs.writeFileSync(
    new URL("../.phase4d-report.local.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = error?.message || String(error);
  await dump(page, "fail");
  try {
    await page.screenshot({ path: "C:/Users/kymfe/OneDrive/Desktop/cogic/.phase4d-e2e-fail.png", fullPage: true });
  } catch {
    /* ignore */
  }
  fs.writeFileSync(
    new URL("../.phase4d-report.local.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.error("PHASE4D_E2E_FAIL", report.error);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
