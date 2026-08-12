import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { retiredOwnerActionDisposition } from "@/lib/owner/retired-actions";

import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { enqueueRegistrationCredentialJob } from "@/lib/registration/credential-jobs";
import { executeRegistrationOwnerRefund } from "@/lib/registration/admin-refund";
import { correctRegistrationAttendee } from "@/lib/registration/admin-correct";
import { reconcileRegistrationPayment } from "@/lib/registration/admin-reconciliation";
import { registrationHttpStatus, toSafeRegistrationMessage } from "@/lib/registration/errors";
import {
  buildRegistrationOwnerPagination,
  decodeRegistrationOwnerCursor,
  parseRegistrationOwnerPageSize,
} from "@/lib/registration/owner-pagination";
import { processDueRegistrationCredentialJobs } from "@/lib/registration/process-credential-jobs";
import { cancelRegistrationGroup } from "@/lib/registration/slice2-repository";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REGISTRATION_LIST_SELECT =
  "id,registration_group_id,is_primary_registrant,relationship_to_primary,guardian_registration_id,status,salutation,first_name,last_name,email,mobile_phone,assistant_email,country_code,city,state,gender,requires_interpretation,preferred_language,date_of_birth,amount_cents,currency,confirmation_reference,created_at,row_version,registration_products(id,name,product_key),registration_credentials(id,status,badge_code),registration_payments(id,status,amount_cents,currency,stripe_payment_intent_id,created_at),registration_groups(id,status,row_version,registration_policy_acceptances(policy_version,authorized_signer_name,agreement_signer_name,accepted_at))";

const clean = (value: unknown) => String(value ?? "").trim();
const hash = (content: string) => createHash("sha256").update(content).digest("hex");

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

async function fetchRegistrationPage(input: {
  status: string | null;
  product: string | null;
  search: string | null;
  cursorRaw: string | null;
  pageSize: number;
}) {
  const db = getSupabaseAdmin();
  const cursor = decodeRegistrationOwnerCursor(input.cursorRaw);
  if (input.cursorRaw && !cursor) {
    throw new Error("INVALID_CURSOR");
  }

  let query = db
    .from("registrations")
    .select(REGISTRATION_LIST_SELECT)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.pageSize + 1);

  if (input.status) {
    query = query.eq("status", input.status);
  }
  if (input.product) {
    query = query.eq("registration_product_id", input.product);
  }
  if (input.search) {
    const safe = input.search.replace(/[,%()"]/g, "");
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,confirmation_reference.ilike.%${safe}%`,
    );
  }
  if (cursor) {
    const createdAt = cursor.createdAt.replace(/"/g, "");
    const id = cursor.id.replace(/"/g, "");
    query = query.or(
      `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt."${id}")`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return buildRegistrationOwnerPagination({
    pageSize: input.pageSize,
    rows: data ?? [],
  });
}

async function fetchRegistrationTotal(input: { status: string | null; product: string | null; search: string | null }) {
  let query = getSupabaseAdmin().from("registrations").select("id", { count: "exact", head: true }).eq("program_key", DEFAULT_PROGRAM_KEY);
  if (input.status) query = query.eq("status", input.status);
  if (input.product) query = query.eq("registration_product_id", input.product);
  if (input.search) {
    const safe = input.search.replace(/[,%()\"]/g, "");
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,confirmation_reference.ilike.%${safe}%`);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function buildCsvExport(input: {
  status: string | null;
  product: string | null;
  search: string | null;
}) {
  const pageSize = 100;
  const rows: string[][] = [
    ["Reference", "Registrant", "Email", "Phone", "Product", "Status", "Amount", "Credential", "Created"],
  ];
  let cursorRaw: string | null = null;
  let guard = 0;

  while (guard < 200) {
    guard += 1;
    const page = await fetchRegistrationPage({
      status: input.status,
      product: input.product,
      search: input.search,
      cursorRaw,
      pageSize,
    });

    for (const row of page.pageRows as Array<Record<string, unknown>>) {
      const productRelation = firstRelation(
        row.registration_products as { name?: string } | { name?: string }[] | null,
      );
      const credentialRelation = firstRelation(
        row.registration_credentials as { status?: string } | { status?: string }[] | null,
      );
      rows.push([
        String(row.confirmation_reference ?? ""),
        `${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`.trim(),
        String(row.email ?? ""),
        String(row.mobile_phone ?? ""),
        productRelation?.name ?? "",
        String(row.status ?? ""),
        String(row.amount_cents ?? ""),
        credentialRelation?.status ?? "",
        String(row.created_at ?? ""),
      ]);
    }

    if (!page.pagination.hasMore || !page.pagination.nextCursor) {
      break;
    }
    cursorRaw = page.pagination.nextCursor;
  }

  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return rows.map((row) => row.map(escape).join(",")).join("\n");
}

export async function GET(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const product = url.searchParams.get("product");
  const search = url.searchParams.get("q")?.trim() || null;
  const db = getSupabaseAdmin();

  if (url.searchParams.get("format") === "csv") {
    try {
      const csv = await buildCsvExport({ status, product, search });
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=registrations.csv",
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return NextResponse.json({ error: "Unable to export registrations." }, { status: 500 });
    }
  }

  const pageSize = parseRegistrationOwnerPageSize(url.searchParams.get("pageSize"));
  const cursorRaw = url.searchParams.get("cursor");

  try {
    const [{ pageRows, pagination }, totalRecords, productsResult, policiesResult, acceptancesResult, jobsResult] =
      await Promise.all([
        fetchRegistrationPage({
          status,
          product,
          search,
          cursorRaw,
          pageSize,
        }),
        fetchRegistrationTotal({ status, product, search }),
        db
          .from("registration_products")
          .select("id,name")
          .eq("program_key", DEFAULT_PROGRAM_KEY)
          .order("name"),
        db
          .from("registration_policies")
          .select(
            "id,version,title,content,status,effective_at,published_at,superseded_at,created_at,updated_at,created_by,updated_by",
          )
          .eq("program_key", DEFAULT_PROGRAM_KEY)
          .order("created_at", { ascending: false }),
        db.from("registration_policy_acceptances").select("policy_id"),
        db
          .from("registration_credential_jobs")
          .select(
            "id,registration_id,group_id,status,attempt_count,max_attempts,next_attempt_at,last_error_code,last_error,terminal_reason,last_attempt_at,completed_at,created_at,updated_at",
          )
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

    if (productsResult.error || policiesResult.error || acceptancesResult.error || jobsResult.error) {
      return NextResponse.json({ error: "Unable to load registrations." }, { status: 500 });
    }

    const counts = new Map<string, number>();
    for (const row of acceptancesResult.data ?? []) {
      counts.set(row.policy_id, (counts.get(row.policy_id) ?? 0) + 1);
    }

    return NextResponse.json(
      {
        data: pageRows,
        pagination: { ...pagination, totalRecords },
        // Compatibility aliases for existing owner surfaces during cutover.
        registrations: pageRows,
        products: productsResult.data ?? [],
        policies: (policiesResult.data ?? []).map((policy) => ({
          ...policy,
          acceptanceCount: counts.get(policy.id) ?? 0,
        })),
        credentialJobs: jobsResult.data ?? [],
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "Invalid pagination cursor." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to load registrations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = await request.json().catch(() => null);
  if (body?.action !== "create_policy") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const content = clean(body.content);
  const title = clean(body.title);
  const version = clean(body.version);
  const effectiveAt = clean(body.effectiveAt);
  if (!content || !title || !version || !effectiveAt) {
    return NextResponse.json(
      { error: "Version, title, effective date, and approved policy content are required." },
      { status: 400 },
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .from("registration_policies")
    .insert({
      program_key: DEFAULT_PROGRAM_KEY,
      version,
      title,
      content,
      content_hash: hash(content),
      effective_at: new Date(effectiveAt).toISOString(),
      status: "draft",
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select("*")
    .single();

  return error
    ? NextResponse.json({ error: "Unable to create policy version." }, { status: 400 })
    : NextResponse.json({ policy: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = await request.json().catch(() => null);
  const db = getSupabaseAdmin();
  const id = clean(body?.id);
  const groupId = clean(body?.groupId);

  // Fail closed before identifiers or DB access: payment/webhook RPCs own confirmation.
  const retiredAction = retiredOwnerActionDisposition("registration", body?.action);
  if (retiredAction) {
    return NextResponse.json(
      { error: retiredAction.error, code: retiredAction.code },
      { status: 410 },
    );
  }

  if (
    !id &&
    !groupId &&
    body?.action !== "process_credential_queue" &&
    body?.action !== "cancel_registration"
  ) {
    return NextResponse.json({ error: "Policy or registration group is required." }, { status: 400 });
  }

  if (body?.action === "edit_policy") {
    const content = clean(body.content);
    const title = clean(body.title);
    const effectiveAt = clean(body.effectiveAt);
    if (!content || !title || !effectiveAt) {
      return NextResponse.json(
        { error: "Title, effective date, and policy content are required." },
        { status: 400 },
      );
    }
    const { data, error } = await db
      .from("registration_policies")
      .update({
        title,
        content,
        content_hash: hash(content),
        effective_at: new Date(effectiveAt).toISOString(),
        updated_by: auth.userId,
      })
      .eq("id", id)
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Only draft policies may be edited." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "publish_policy") {
    const { data: draft } = await db
      .from("registration_policies")
      .select("id,title,content,effective_at")
      .eq("id", id)
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .eq("status", "draft")
      .maybeSingle();
    if (!draft?.title?.trim() || !draft.content?.trim() || !draft.effective_at) {
      return NextResponse.json(
        { error: "A complete draft is required before publication." },
        { status: 409 },
      );
    }
    const { data: active } = await db
      .from("registration_policies")
      .select("id,version")
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .eq("status", "published")
      .maybeSingle();
    if (active && body?.acknowledgeSupersede !== true) {
      return NextResponse.json(
        {
          error: `Publishing this draft will supersede active policy ${active.version}. Confirm that transition to continue.`,
          requiresSupersedeConfirmation: true,
          activePolicyVersion: active.version,
        },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    const { error: supersedeError } = await db
      .from("registration_policies")
      .update({ status: "superseded", superseded_at: now, updated_by: auth.userId })
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .eq("status", "published");
    if (supersedeError) {
      return NextResponse.json({ error: "Unable to supersede the current policy." }, { status: 500 });
    }
    const { data, error } = await db
      .from("registration_policies")
      .update({ status: "published", published_at: now, updated_by: auth.userId })
      .eq("id", id)
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Unable to publish policy." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "retire_policy") {
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("registration_policies")
      .update({ status: "retired", superseded_at: now, updated_by: auth.userId })
      .eq("id", id)
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .eq("status", "published")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { error: "Only the active published policy may be retired." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "cancel_registration") {
    const reason = clean(body.reason);
    if (reason.length < 8) {
      return NextResponse.json(
        { error: "A cancellation reason of at least 8 characters is required." },
        { status: 400 },
      );
    }
    if (!groupId) {
      return NextResponse.json(
        { error: "groupId is required for atomic registration group cancellation." },
        { status: 400 },
      );
    }

    const [{ data: group, error: groupError }, { data: members, error: membersError }] =
      await Promise.all([
        db
          .from("registration_groups")
          .select("id,row_version,status")
          .eq("id", groupId)
          .maybeSingle(),
        db
          .from("registrations")
          .select("id,row_version,status,program_key")
          .eq("registration_group_id", groupId),
      ]);

    if (groupError || membersError) {
      return NextResponse.json(
        { error: "Unable to lock the registration group for cancellation." },
        { status: 503 },
      );
    }
    if (!group) {
      return NextResponse.json({ error: "Registration group not found." }, { status: 404 });
    }
    if (!(members ?? []).some((member) => member.program_key === DEFAULT_PROGRAM_KEY)) {
      return NextResponse.json(
        { error: "Registration group is not part of the active program." },
        { status: 404 },
      );
    }

    try {
      const result = await cancelRegistrationGroup({
        groupId: group.id,
        actorUserId: auth.userId,
        reason,
        groupVersion: Number(group.row_version),
        memberVersions: Object.fromEntries(
          (members ?? []).map((member) => [member.id, Number(member.row_version)]),
        ),
      });
      return NextResponse.json({ ok: true, transition: result });
    } catch (error) {
      return NextResponse.json(
        { error: toSafeRegistrationMessage(error) },
        { status: registrationHttpStatus(error) },
      );
    }
  }

  if (body?.action === "retry_credential") {
    try {
      const job = await enqueueRegistrationCredentialJob({
        registrationId: id,
        actorUserId: auth.userId,
        errorCode: "manual_admin_retry",
        errorMessage:
          "Credential retry manually requested by an authenticated registration administrator.",
      });
      return NextResponse.json({ ok: true, job }, { status: 202 });
    } catch (error) {
      return NextResponse.json(
        { error: toSafeRegistrationMessage(error) },
        { status: registrationHttpStatus(error) },
      );
    }
  }

  if (body?.action === "refund") {
    if (["amountCents", "amount_cents", "totalCents", "requestedAmountCents"].some((key) => key in (body ?? {}))) {
      return NextResponse.json({ error: "Client-supplied refund amounts are rejected." }, { status: 400 });
    }
    try {
      const refund = await executeRegistrationOwnerRefund({ registrationId: id, actorUserId: auth.userId, reason: clean(body.reason), idempotencyKey: clean(body.idempotencyKey) || null });
      return NextResponse.json({ ok: true, refund }, { status: refund.idempotent ? 200 : 201 });
    } catch (error) {
      return NextResponse.json({ error: toSafeRegistrationMessage(error) }, { status: registrationHttpStatus(error) });
    }
  }

  if (body?.action === "reconcile_payment") {
    const reconciliationAction = clean(body.reconciliationAction);
    if (!(["verify_stripe", "retry_webhook", "offline_check"] as const).includes(reconciliationAction as never)) {
      return NextResponse.json({ error: "reconciliationAction must be verify_stripe, retry_webhook, or offline_check." }, { status: 422 });
    }
    try {
      const result = await reconcileRegistrationPayment({
        action: reconciliationAction as "verify_stripe" | "retry_webhook" | "offline_check",
        registrationId: id,
        actorUserId: auth.userId,
        notes: clean(body.notes),
        reference: clean(body.reference),
      });
      return NextResponse.json({ ok: true, reconciliation: result });
    } catch (error) {
      return NextResponse.json({ error: toSafeRegistrationMessage(error) }, { status: registrationHttpStatus(error) });
    }
  }

  if (body?.action === "correct_attendee") {
    try {
      const registration = await correctRegistrationAttendee({ registrationId: id, actorUserId: auth.userId, corrections: body.corrections, reason: clean(body.reason), expectedRegistrationVersion: typeof body.expectedRegistrationVersion === "number" ? body.expectedRegistrationVersion : null });
      return NextResponse.json({ ok: true, registration });
    } catch (error) {
      return NextResponse.json({ error: toSafeRegistrationMessage(error) }, { status: registrationHttpStatus(error) });
    }
  }

  if (body?.action === "process_credential_queue") {
    try {
      const result = await processDueRegistrationCredentialJobs(Number(body.limit) || 25);
      return NextResponse.json({ ok: true, result });
    } catch (error) {
      return NextResponse.json(
        { error: toSafeRegistrationMessage(error) },
        { status: registrationHttpStatus(error) },
      );
    }
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
