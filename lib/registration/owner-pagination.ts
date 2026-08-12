export type RegistrationOwnerCursor = {
  createdAt: string;
  id: string;
};

export type RegistrationOwnerPagination = {
  pageSize: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export const REGISTRATION_OWNER_DEFAULT_PAGE_SIZE = 50;
export const REGISTRATION_OWNER_MAX_PAGE_SIZE = 100;

export function parseRegistrationOwnerPageSize(raw: string | null | undefined): number {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return REGISTRATION_OWNER_DEFAULT_PAGE_SIZE;
  }
  return Math.min(REGISTRATION_OWNER_MAX_PAGE_SIZE, Math.max(1, parsed));
}

export function encodeRegistrationOwnerCursor(cursor: RegistrationOwnerCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeRegistrationOwnerCursor(
  raw: string | null | undefined,
): RegistrationOwnerCursor | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "string" || !parsed.createdAt.trim()) {
      return null;
    }
    if (typeof parsed.id !== "string" || !parsed.id.trim()) {
      return null;
    }
    return {
      createdAt: parsed.createdAt.trim(),
      id: parsed.id.trim(),
    };
  } catch {
    return null;
  }
}

export function buildRegistrationOwnerPagination(input: {
  pageSize: number;
  rows: Array<{ created_at?: string | null; id?: string | null }>;
}): {
  pageRows: Array<{ created_at?: string | null; id?: string | null }>;
  pagination: RegistrationOwnerPagination;
} {
  const hasMore = input.rows.length > input.pageSize;
  const pageRows = hasMore ? input.rows.slice(0, input.pageSize) : input.rows;
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last?.created_at && last?.id
      ? encodeRegistrationOwnerCursor({
          createdAt: String(last.created_at),
          id: String(last.id),
        })
      : null;

  return {
    pageRows,
    pagination: {
      pageSize: input.pageSize,
      nextCursor,
      hasMore,
    },
  };
}
