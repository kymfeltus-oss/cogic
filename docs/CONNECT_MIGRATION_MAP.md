# COGIC Connect Migration Map

Audience: any authenticated COGIC LIVE app user (`auth.users`). Not registration-gated.

## 1. Current entry points

| Surface | Path / symbol | Behavior |
|---|---|---|
| Dashboard card | `lib/dashboard/dashboard-utilities.ts` → title `COGIC Connect`, href `/social` | Primary discoverability |
| Page | `app/social/page.tsx` | Renders `SocialCommunityClient` |
| Client | `components/social/SocialCommunityClient.tsx` | Compose ≤200 chars, feed, pin display, report dialog, mute/pause UI |
| Hook | `lib/experience/useFellowshipChat.ts` | Loads/posts via fellowship-chat API + realtime |
| Live Chat (must stay separate) | `app/api/live/chat/route.ts` | Also reads/writes `chat_messages` |

## 2. Current backend tables

| Table | Migration | Role today |
|---|---|---|
| `public.chat_messages` | `0001_initial_schema.sql` + `20260612120100_fellowship_chat_moderation.sql` | Shared Live Chat + Connect store. Columns: `id`, `user_id` → `auth.users`, `email`, `content` (DB 1–500), `created_at`, `deleted_at`, `deleted_by`, `is_pinned`, `pinned_at`, `pinned_by` |
| `public.chat_room_mutes` | `20260612120100_fellowship_chat_moderation.sql` | User mute until timestamp; used by fellowship + owner social mute |
| `public.social_settings` | `20260808190000_cogic_social_moderation.sql` | Singleton `id='community'`, `posting_enabled` |
| `public.chat_message_reports` | `20260808190000_cogic_social_moderation.sql` | Reports on `chat_messages` |

## 3. Current `/social` logic

1. Client calls `GET /api/experience/fellowship-chat`.
2. Server loads non-deleted `chat_messages` (+ pinned), `social_settings.posting_enabled`, mute from `chat_room_mutes`.
3. Post → `POST` same route; app validates 1–200 chars (`FELLOWSHIP_MAX_CONTENT_LENGTH`); inserts into `chat_messages`.
4. Report → `POST /api/social/reports` → upsert `chat_message_reports`.

## 4. Current owner/admin API (`/api/owner/social`)

| Action | Table effect |
|---|---|
| `set_posting` | upsert `social_settings` |
| `pin` / `unpin` | update `chat_messages.is_pinned*` |
| `remove` / `restore` | soft-delete / clear `deleted_at` on `chat_messages` |
| `mute` / `unmute` | upsert/delete `chat_room_mutes` |
| `resolve_report` / `dismiss_report` | update `chat_message_reports.status` |

No owner UI page exists yet (API only).

## 5. Why a hard split is required

`chat_messages` has **no channel / room discriminator**. Live Chat and Connect currently share one stream. Historical rows cannot be safely auto-classified as “live” vs “community” without inventing data. Therefore:

- Live Chat keeps `chat_messages` (+ `chat_room_mutes` for live).
- Connect gets new `connect_*` + `direct_messages` tables.
- Do **not** bulk-copy mixed `chat_messages` into Connect.

## 6. Target architecture

| Concern | Table(s) |
|---|---|
| Live streaming chat | keep `chat_messages` + `chat_room_mutes` |
| Public Connect feed | `connect_posts`, `connect_post_media`, `connect_post_reactions` |
| Connect moderation | `connect_user_mutes`, `connect_post_reports`; keep `social_settings` |
| Direct messages | `direct_messages` (+ view `direct_messages_with_status`) |
| Media objects | Storage bucket `connect-media` |

## 7. Migration file

`supabase/migrations/20260810190000_cogic_connect_decouple.sql`

Enforces:

- Connect / DM body length **1–200** at the database
- All user FKs → `auth.users(id)`
- Media HTTPS URLs, max 4 attachments
- Like / Amen counters maintained by triggers
- One pinned Connect post at a time
- RLS for authenticated participants; service role for owner/server writes

## 8. Required application retargets (after migration apply)

| File | Change |
|---|---|
| `lib/social/connect-server.ts` + `app/api/social/posts` | Connect feed read/write on `connect_posts` / `connect_post_media` (service role inserts) |
| `lib/experience/fellowship-chat-server.ts` + fellowship-chat route | Remain on `chat_messages` for Live Chat / seeds / countdown monitors |
| `app/api/social/reports/route.ts` | Target `connect_post_reports` / `connect_posts` |
| `app/api/owner/social/route.ts` | Pin/mute/pause/report against `connect_*` + `connect_user_mutes` |
| `app/api/live/chat/route.ts` | Remain on `chat_messages` only |
| `app/api/social/dms` + `DMOverlayPopup` | `direct_messages` inbox / thread / send |
| `app/api/social/media` | Upload to `connect-media`, then persist via post create → `connect_post_media` |

## 9. Non-negotiables

- No mock schemas or placeholder tables
- Connect audience = authenticated app users, not registrants-only
- DB enforces 200-character body for Connect posts and DMs
- Live Chat and Connect message stores must not share rows after retarget
- Owner pause continues to use `social_settings.id = 'community'`
