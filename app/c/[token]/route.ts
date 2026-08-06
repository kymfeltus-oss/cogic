import { handleCredentialIngress } from "@/lib/credentials/ingress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { token } = await context.params;
  return handleCredentialIngress(request, token);
}
