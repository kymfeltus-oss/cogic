import { NextResponse } from "next/server";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import {
  createGivingFund,
  listAllGivingFunds,
  updateGivingFund,
} from "@/lib/giving/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  try {
    const funds = await listAllGivingFunds();
    return NextResponse.json(
      { funds },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load funds." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null);
  try {
    const fund = await createGivingFund({
      fundKey: String(body?.fundKey ?? ""),
      label: String(body?.label ?? ""),
      description: body?.description == null ? null : String(body.description),
      active: body?.active !== false,
      published: body?.published !== false,
      sortOrder: Number(body?.sortOrder ?? 0),
      actorUserId: auth.userId,
    });
    return NextResponse.json({ fund }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create fund." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Fund id is required." }, { status: 400 });
  }
  try {
    const fund = await updateGivingFund({
      id,
      label: typeof body?.label === "string" ? body.label : undefined,
      description:
        body?.description === undefined
          ? undefined
          : body.description == null
            ? null
            : String(body.description),
      active: typeof body?.active === "boolean" ? body.active : undefined,
      published: typeof body?.published === "boolean" ? body.published : undefined,
      sortOrder:
        body?.sortOrder === undefined || body?.sortOrder === null
          ? undefined
          : Number(body.sortOrder),
      actorUserId: auth.userId,
    });
    return NextResponse.json({ fund });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update fund." },
      { status: 400 },
    );
  }
}
