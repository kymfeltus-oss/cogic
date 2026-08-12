import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),"utf8");
const migration=read("supabase/migrations/20260807120000_media_library_classification.sql");
const upload=read("app/api/owner/media/upload-session/route.ts");
const edit=read("app/api/owner/replays/[recordingId]/route.ts");
const page=read("app/owner/media/page.tsx");
for(const [name,pattern,source] of [
  ["owner media library exists",/Media[\s\S]*Library/,page],
  ["source and content types are separate",/content_type[\s\S]*media_source_type/,migration],
  ["pre-production classification exists",/PRE_PRODUCTION/,migration],
  ["promo classification exists",/PROMO/,migration],
  ["leadership classification exists",/LEADERSHIP_MESSAGE/,migration],
  ["interview classification exists",/INTERVIEW/,migration],
  ["event preview classification exists",/EVENT_PREVIEW/,migration],
  ["manual upload requires owner",/requireOwnerUser/,upload],
  ["upload validates formats",/isAllowedVideoMimeType/,upload],
  ["upload validates size",/MEDIA_UPLOAD_MAX_BYTES/,upload],
  ["upload preserves storage path",/storage_path/,upload],
  ["upload preserves original filename",/original_filename/,upload],
  ["pre-production occurrence is optional",/occurrenceId && !UUID/,upload],
  ["edit validates content type",/Invalid content type/,edit],
  ["featured is persistent",/patch\.featured/,edit],
  ["destinations are allowlisted",/Invalid publication destination/,edit],
] as const)test(name,()=>assert.match(source,pattern));
