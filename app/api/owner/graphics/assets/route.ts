import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isOwnerAuthed, ownerAuthFailureResponse, ownerJsonResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 128 * 1024 * 1024;
const ALLOWED_ASSET_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

function cleanAssetLabel(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "graphic";
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "graphic";
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return ownerJsonResponse({ success: false, error: "Choose an image or video file to upload." }, 400);
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return ownerJsonResponse({ success: false, error: "Upload an image or video up to 128MB." }, 400);
    }

    const extension = ALLOWED_ASSET_TYPES.get(file.type);
    if (!extension) {
      return ownerJsonResponse({ success: false, error: "Use a PNG, JPG, WEBP, SVG, MP4, WEBM, or MOV file." }, 400);
    }

    const label = cleanAssetLabel(formData.get("slot"));
    const uploadDirectory = path.join(process.cwd(), "public", "owner-graphics");
    const fileName = `${label}-${Date.now()}.${extension}`;
    const filePath = path.join(uploadDirectory, fileName);
    const bytes = Buffer.from(await file.arrayBuffer());

    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(filePath, bytes);

    return ownerJsonResponse({
      success: true,
      asset: {
        label,
        url: `/owner-graphics/${fileName}`,
      },
    });
  } catch (error) {
    console.error("[owner/graphics/assets] POST failed:", error);
    return ownerJsonResponse({ success: false, error: "Unable to upload graphic asset." }, 500);
  }
}
