import { NextResponse } from "next/server";
import type { OwnerAuthFailure, OwnerAuthResult, OwnerAuthSuccess } from "@/lib/owner/auth";

export function ownerAuthFailureResponse(auth: OwnerAuthFailure) {
  return NextResponse.json({ error: auth.message }, { status: auth.status });
}

export function isOwnerAuthed(auth: OwnerAuthResult): auth is OwnerAuthSuccess {
  return auth.ok;
}

export function ownerJsonResponse<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    },
  });
}
