import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";

export const dynamic = "force-dynamic";
const clean = (value: unknown) => String(value ?? "").trim();
const hash = (content: string) => createHash("sha256").update(content).digest("hex");

export async function GET(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const url = new URL(request.url), status = url.searchParams.get("status"), product = url.searchParams.get("product"), search = url.searchParams.get("q")?.trim();
  const db = getSupabaseAdmin();
  let query = db.from("registrations").select("id,registration_group_id,is_primary_registrant,relationship_to_primary,guardian_registration_id,status,salutation,first_name,last_name,email,mobile_phone,assistant_email,country_code,city,state,gender,requires_interpretation,preferred_language,date_of_birth,amount_cents,confirmation_reference,created_at,registration_products(id,name,product_key),registration_credentials(id,status,badge_code),registration_payments(status),registration_groups(id,status,registration_policy_acceptances(policy_version,authorized_signer_name,agreement_signer_name,accepted_at))").eq("program_key", DEFAULT_PROGRAM_KEY).order("created_at", { ascending:false }).limit(250);
  if (status) query = query.eq("status", status);
  if (product) query = query.eq("registration_product_id", product);
  if (search) { const safe = search.replace(/[,%]/g, ""); query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`); }
  const [{data,error},{data:products},{data:policies},{data:acceptances}] = await Promise.all([
    query,
    db.from("registration_products").select("id,name").eq("program_key",DEFAULT_PROGRAM_KEY).order("name"),
    db.from("registration_policies").select("id,version,title,content,status,effective_at,published_at,superseded_at,created_at,updated_at,created_by,updated_by").eq("program_key",DEFAULT_PROGRAM_KEY).order("created_at",{ascending:false}),
    db.from("registration_policy_acceptances").select("policy_id"),
  ]);
  if (error) return NextResponse.json({error:"Unable to load registrations."},{status:500});
  const counts = new Map<string,number>(); for (const row of acceptances ?? []) counts.set(row.policy_id,(counts.get(row.policy_id)??0)+1);
  return NextResponse.json({registrations:data??[],products:products??[],policies:(policies??[]).map(policy=>({...policy,acceptanceCount:counts.get(policy.id)??0}))},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser(); if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(()=>null); if (body?.action !== "create_policy") return NextResponse.json({error:"Unsupported action."},{status:400});
  const content=clean(body.content),title=clean(body.title),version=clean(body.version),effectiveAt=clean(body.effectiveAt);
  if (!content||!title||!version||!effectiveAt) return NextResponse.json({error:"Version, title, effective date, and approved policy content are required."},{status:400});
  const {data,error}=await getSupabaseAdmin().from("registration_policies").insert({program_key:DEFAULT_PROGRAM_KEY,version,title,content,content_hash:hash(content),effective_at:new Date(effectiveAt).toISOString(),status:"draft",created_by:auth.userId,updated_by:auth.userId}).select("*").single();
  return error?NextResponse.json({error:"Unable to create policy version."},{status:400}):NextResponse.json({policy:data},{status:201});
}

export async function PATCH(request: Request) {
  const auth=await requireOwnerUser(); if(!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body=await request.json().catch(()=>null),db=getSupabaseAdmin(),id=clean(body?.id);
  if (!id) return NextResponse.json({error:"Policy or registration is required."},{status:400});
  if(body?.action==="edit_policy"){
    const content=clean(body.content),title=clean(body.title),effectiveAt=clean(body.effectiveAt);
    if(!content||!title||!effectiveAt)return NextResponse.json({error:"Title, effective date, and policy content are required."},{status:400});
    const {data,error}=await db.from("registration_policies").update({title,content,content_hash:hash(content),effective_at:new Date(effectiveAt).toISOString(),updated_by:auth.userId}).eq("id",id).eq("program_key",DEFAULT_PROGRAM_KEY).eq("status","draft").select("id").maybeSingle();
    if(error||!data)return NextResponse.json({error:"Only draft policies may be edited."},{status:409}); return NextResponse.json({ok:true});
  }
  if(body?.action==="publish_policy"){
    const {data:draft}=await db.from("registration_policies").select("id,title,content,effective_at").eq("id",id).eq("program_key",DEFAULT_PROGRAM_KEY).eq("status","draft").maybeSingle();
    if(!draft?.title?.trim()||!draft.content?.trim()||!draft.effective_at)return NextResponse.json({error:"A complete draft is required before publication."},{status:409});
    const {data:active}=await db.from("registration_policies").select("id,version").eq("program_key",DEFAULT_PROGRAM_KEY).eq("status","published").maybeSingle();
    if(active&&body?.acknowledgeSupersede!==true)return NextResponse.json({error:`Publishing this draft will supersede active policy ${active.version}. Confirm that transition to continue.`,requiresSupersedeConfirmation:true,activePolicyVersion:active.version},{status:409});
    const now=new Date().toISOString(); const {error:supersedeError}=await db.from("registration_policies").update({status:"superseded",superseded_at:now,updated_by:auth.userId}).eq("program_key",DEFAULT_PROGRAM_KEY).eq("status","published");
    if(supersedeError)return NextResponse.json({error:"Unable to supersede the current policy."},{status:500});
    const {data,error}=await db.from("registration_policies").update({status:"published",published_at:now,updated_by:auth.userId}).eq("id",id).eq("program_key",DEFAULT_PROGRAM_KEY).eq("status","draft").select("id").maybeSingle();
    if(error||!data)return NextResponse.json({error:"Unable to publish policy."},{status:409}); return NextResponse.json({ok:true});
  }
  if(body?.action==="retire_policy"){
    const now=new Date().toISOString(); const {data,error}=await db.from("registration_policies").update({status:"retired",superseded_at:now,updated_by:auth.userId}).eq("id",id).eq("program_key",DEFAULT_PROGRAM_KEY).eq("status","published").select("id").maybeSingle();
    if(error||!data)return NextResponse.json({error:"Only the active published policy may be retired."},{status:409}); return NextResponse.json({ok:true});
  }
  if(body?.action==="cancel_registration"){
    const {data,error}=await db.from("registrations").update({status:"canceled",canceled_at:new Date().toISOString(),updated_by:auth.userId}).eq("id",id).eq("program_key",DEFAULT_PROGRAM_KEY).in("status",["draft","submitted","payment_pending"]).select("id").maybeSingle();
    if(error||!data)return NextResponse.json({error:"Registration cannot be canceled from its current state."},{status:409}); return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"Unsupported action."},{status:400});
}
