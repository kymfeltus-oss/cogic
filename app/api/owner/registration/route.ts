/**
 * Canonical singular Registration Hub owner endpoint.
 * The plural route remains as a compatibility surface for the existing owner UI.
 */
export const dynamic = "force-dynamic";

export { GET, PATCH, POST } from "@/app/api/owner/registrations/route";
