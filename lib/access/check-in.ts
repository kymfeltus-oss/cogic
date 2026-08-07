import "server-only";
import { credentialTokenHashHex, isValidCredentialToken } from "@/lib/credentials/token";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";

export const SCAN_REASON_LABELS:Record<string,string>={VALID_REGISTRATION:"Valid registration",VALID_TICKET:"Valid ticket",PREFERRED_SEATING:"Preferred seating",GENERAL_SEATING:"General seating",PREFERRED_WINDOW_EXPIRED:"Preferred seating hold period has ended; route to general seating",MUSICAL_TICKET_REQUIRED:"A valid Musical ticket is required",WRONG_EVENT:"Credential is for a different event",WRONG_ZONE:"Credential does not permit this access zone",CREDENTIAL_REVOKED:"Credential is revoked or expired",REGISTRATION_CANCELED:"Registration is canceled or refunded",PAYMENT_NOT_CONFIRMED:"Payment is not confirmed",TICKET_REVOKED:"Ticket is revoked, refunded, or expired",TICKET_ALREADY_USED:"Already checked in",ENTITLEMENT_EXPIRED:"Entitlement has expired",GUARDIAN_REQUIRED:"Guardian required",NOT_YET_VALID:"Credential is not yet valid",INVALID_CREDENTIAL:"Credential was not recognized",NO_APPLICABLE_ENTITLEMENT:"No applicable entitlement"};

export function extractCredentialReference(value:string){
  const raw=value.trim();
  if(/^CS26-[A-Z0-9]{8}$/i.test(raw))return {hash:"",reference:raw.toUpperCase()};
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw))return {hash:"",reference:raw.toLowerCase()};
  let token=raw;try{const url=new URL(raw);token=url.pathname.split("/").filter(Boolean).at(-1)||"";}catch{}
  return isValidCredentialToken(token)?{hash:credentialTokenHashHex(token),reference:""}:null;
}

export async function processAccessScan(input:{value:string;occurrenceId:string;zoneId:string;scannerUserId:string;inputMethod:"camera"|"manual";guardianPresent?:boolean}){
  const ref=extractCredentialReference(input.value);if(!ref)return {decision:"DENIED",reasonCode:"INVALID_CREDENTIAL",entryRecorded:false};
  const {data,error}=await getSupabaseAdmin().rpc("process_access_scan",{p_token_hash_hex:ref.hash,p_reference:ref.reference,p_occurrence_id:input.occurrenceId,p_zone_id:input.zoneId,p_scanner_user_id:input.scannerUserId,p_input_method:input.inputMethod,p_guardian_present:input.guardianPresent===true});
  if(error)throw error;return data;
}

export async function loadCheckInOperations(){const db=getSupabaseAdmin(),now=new Date(),from=new Date(now.getTime()-12*60*60*1000).toISOString(),to=new Date(now.getTime()+36*60*60*1000).toISOString();const [occurrences,zones,rules,scans,entitlements]=await Promise.all([
  db.from("event_occurrences").select("id,title_override,scheduled_start_at,scheduled_end_at,status,venue_label,events(title,event_type)").eq("visibility","published").neq("status","canceled").gte("scheduled_start_at",from).lte("scheduled_start_at",to).order("scheduled_start_at"),
  db.from("access_zones").select("id,zone_key,name,description,active").eq("program_key",DEFAULT_PROGRAM_KEY).order("name"),
  db.from("occurrence_access_rules").select("id,event_occurrence_id,access_zone_id,entitlement_id,access_mode,usage_mode,allow_general_fallback,active,access_zones(name,zone_key),access_entitlements(name,entitlement_key)").eq("active",true),
  db.from("access_scan_attempts").select("id,scanned_at,decision,reason_code,credential_type,event_occurrence_id,access_zone_id,scanner_user_id,entry_recorded,registrations(first_name,last_name,registration_products(name)),ticket_instances(holder_name,ticket_products(name)),event_occurrences(title_override,events(title)),access_zones(name)").eq("program_key",DEFAULT_PROGRAM_KEY).order("scanned_at",{ascending:false}).limit(100),
  db.from("access_entitlements").select("id,name,entitlement_key,event_type,access_zone").eq("program_key",DEFAULT_PROGRAM_KEY).eq("active",true).in("entitlement_type",["event_access","seating"])
]);
  const rows=scans.data??[];const stats={total:rows.length,granted:rows.filter((x:any)=>x.decision.startsWith("ALLOWED")).length,denied:rows.filter((x:any)=>x.decision==="DENIED").length,alreadyUsed:rows.filter((x:any)=>x.reason_code==="TICKET_ALREADY_USED").length,checkedIn:rows.filter((x:any)=>x.entry_recorded).length};
  const countBy=(label:(row:any)=>string)=>Object.entries(rows.reduce((all:Record<string,number>,row:any)=>{const key=label(row)||"Unknown";all[key]=(all[key]||0)+1;return all},{})).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);
  const breakdowns={byEvent:countBy((x:any)=>x.event_occurrences?.title_override||x.event_occurrences?.events?.title),byProduct:countBy((x:any)=>x.registrations?.registration_products?.name||x.ticket_instances?.ticket_products?.name),byCredential:countBy((x:any)=>x.credential_type)};
  return {occurrences:occurrences.data??[],zones:zones.data??[],rules:rules.data??[],scans:rows,entitlements:entitlements.data??[],stats,breakdowns};
}

export async function searchOperationalCredentials(query:string){const q=query.trim().slice(0,100);if(q.length<2)return[];const db=getSupabaseAdmin();const [{data:regs},{data:tickets}]=await Promise.all([
  db.from("registrations").select("id,first_name,last_name,confirmation_reference,status,registration_products(name),registration_credentials(badge_code,status)").eq("program_key",DEFAULT_PROGRAM_KEY).or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,confirmation_reference.ilike.%${q}%`).limit(12),
  db.from("ticket_instances").select("id,holder_name,status,ticket_products(name,event_occurrences(title_override,events(title)))").or(`holder_name.ilike.%${q}%,id.eq.${/^[0-9a-f-]{36}$/i.test(q)?q:"00000000-0000-0000-0000-000000000000"}`).limit(12)
]);return [...(regs??[]).map((x:any)=>({type:"registration",id:x.id,name:`${x.first_name} ${x.last_name}`,reference:x.registration_credentials?.[0]?.badge_code,status:x.status,product:x.registration_products?.name})),...(tickets??[]).map((x:any)=>({type:"ticket",id:x.id,name:x.holder_name||"Ticket holder",reference:x.id,status:x.status,product:x.ticket_products?.name}))];}
