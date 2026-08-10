import { NextResponse } from "next/server";
import {
  CONNECT_MEDIA_BUCKET,
  CONNECT_MEDIA_MAX_BYTES,
  connectMediaObjectPath,
  connectMediaTypeFromMime,
  isAllowedConnectMediaMime,
  publicConnectMediaUrl,
} from "@/lib/social/connect-media";
import { CONNECT_MAX_MEDIA } from "@/lib/social/connect-types";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json({ error: "Sign in to upload media." }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .concat(formData.getAll("file"))
      .filter((value): value is File => value instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "Choose at least one image or video." }, { status: 400 });
    }
    if (files.length > CONNECT_MAX_MEDIA) {
      return NextResponse.json(
        { error: `Maximum of ${CONNECT_MAX_MEDIA} media attachments allowed.` },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
    }

    const uploaded = [];
    for (const file of files) {
      if (!isAllowedConnectMediaMime(file.type)) {
        return NextResponse.json(
          { error: "Use JPG, PNG, WebP, GIF, MP4, MOV, or WebM files." },
          { status: 400 },
        );
      }
      if (file.size <= 0 || file.size > CONNECT_MEDIA_MAX_BYTES) {
        return NextResponse.json({ error: "Each file must be 50 MB or smaller." }, { status: 400 });
      }

      const mediaType = connectMediaTypeFromMime(file.type);
      if (!mediaType) {
        return NextResponse.json({ error: "Unsupported media type." }, { status: 400 });
      }

      const path = connectMediaObjectPath(user.id, file.type);
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(CONNECT_MEDIA_BUCKET)
        .upload(path, buffer, {
          upsert: false,
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      uploaded.push({
        type: mediaType,
        path,
        url: publicConnectMediaUrl(supabaseUrl, path),
        mimeType: file.type,
        size: file.size,
      });
    }

    return NextResponse.json({ items: uploaded }, { status: 201 });
  } catch (error) {
    console.error("Connect media upload failed:", error);
    return NextResponse.json({ error: "Unable to upload media." }, { status: 500 });
  }
}
