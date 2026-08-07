import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";
import { credentialTokenHashHex, generateCredentialToken, hashCredentialToken } from "@/lib/credentials/token";

export const TICKET_CHECKOUT_TYPE="ticket_purchase";
export type PurchaseLine={type:"ticket"|"addon";productId:string;quantity:number};

export async function loadTicketStore(userId?:string){
  const db=getSupabaseAdmin(),now=new Date().toISOString();await db.rpc("release_expired_ticket_reservations");
  const [tickets,addons,orders]=await Promise.all([
    db.from("ticket_products").select("id,product_key,name,description,price_cents,currency,capacity,sold_count,reserved_count,sale_start,sale_end,per_order_limit,event_occurrence_id,event_occurrences(local_date,scheduled_start_at,scheduled_end_at,status,visibility,events(title,event_type,status))").eq("program_key",DEFAULT_PROGRAM_KEY).eq("active",true).eq("public",true).order("sort_order"),
    db.from("addon_products").select("id,addon_key,name,description,price_cents,currency,included,max_quantity,fulfillment_type,available_from,available_until").eq("program_key",DEFAULT_PROGRAM_KEY).eq("active",true).eq("public",true).order("name"),
    userId?db.from("commerce_orders").select("id,status,fulfillment_status,amount_cents,created_at,commerce_order_lines(id,line_type,name_snapshot,quantity,unit_amount_cents,fulfillment_status,ticket_instances(id,holder_name,status,complimentary,issued_at,used_at,ticket_product_id,ticket_products(name,event_occurrences(local_date,scheduled_start_at,events(title)))) )").eq("purchaser_user_id",userId).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
  ]);
  const ticketProducts=(tickets.data??[]).map((p:any)=>({...p,inventoryState:!p.sale_start||now>=p.sale_start?(!p.sale_end||now<p.sale_end?(p.capacity-p.sold_count-p.reserved_count<=0?"sold_out":p.capacity-p.sold_count-p.reserved_count<=10?"limited":"available"):"sale_closed"):"sale_closed",remaining:p.capacity-p.sold_count-p.reserved_count}));
  return {ticketProducts,addons:addons.data??[],orders:orders.data??[],processingFeeConfigured:false};
}

export async function issueTicketPresentation(userId:string,ticketId:string){
  const db=getSupabaseAdmin();const {data:ticket}=await db.from("ticket_instances").select("id,status,purchaser_user_id,assigned_user_id,ticket_products(name,event_occurrences(local_date,scheduled_start_at,events(title)))").eq("id",ticketId).or(`purchaser_user_id.eq.${userId},assigned_user_id.eq.${userId}`).maybeSingle();
  if(!ticket)throw new Error("Ticket not found.");if(ticket.status!=="valid")throw new Error(`Ticket is ${ticket.status}.`);
  const token=generateCredentialToken(),hash=hashCredentialToken(token);await db.from("ticket_credentials").update({status:"rotated"}).eq("ticket_id",ticketId).eq("status","active");
  const {error}=await db.from("ticket_credentials").upsert({ticket_id:ticketId,token_hash:hash,status:"active",issued_at:new Date().toISOString()},{onConflict:"ticket_id"});if(error)throw error;
  const origin=(process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN||process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"");if(!origin)throw new Error("Public web origin is unavailable.");
  return {token,url:`${origin}/t/${token}`,ticket};
}

export async function resolveTicketToken(token:string){
  const db=getSupabaseAdmin(),hash=`\\x${credentialTokenHashHex(token)}`;const {data}=await db.from("ticket_credentials").select("status,ticket_instances(id,status,holder_name,complimentary,ticket_products(name,event_occurrence_id,event_occurrences(local_date,scheduled_start_at,events(title))))").eq("token_hash",hash).eq("status","active").maybeSingle();
  const ticket=(data as any)?.ticket_instances;if(!ticket||ticket.status!=="valid")return null;return ticket;
}
