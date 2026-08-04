# Owner Broadcast Contract

> Canonical reference for `/owner/**` and `/api/owner/**`. Attendee surfaces (`/live`, `/experience/**`) remain read-only viewers.

## Three axes (never collapse into one badge)

### 1. Event phase — what the schedule says

| Phase | Meaning |
|-------|---------|
| `idle` | No valid active countdown schedule |
| `scheduled` | Before the 2-hour holding window |
| `preshow` | Holding room window (2 hours before start) |
| `live` | Schedule window is open (between start and end) |
| `ended` | Past show end time |

**`eventPhase.live` ≠ attendees watching video.** It only means the countdown schedule says the show window is open.

### 2. Publish state — what the operator pipeline is doing

| Field | Values |
|-------|--------|
| `mode` | `none`, `external_hls`, `rtmp_encoder`, `browser_camera` |
| `status` | `offline`, `preflight`, `starting`, `publishing`, `ending`, `error` |

Encoder or Restream ingest running is `publish.status = publishing`. That is not the same as attendee playback.

### 3. Playback state — what the attendee player can do

| Status | Meaning |
|--------|---------|
| `unconfigured` | No safe public HLS URL |
| `ready` | URL exists and manifest validates; gate not open |
| `playback_pending` | Go-live requested / `is_live` flipped; player not confirmed |
| `live` | Attendee manifest resolves and playback is confirmed |
| `error` | Broken URL or failed after pending |

## Go-live sequence (transaction-like, not atomic)

1. Owner requests start → `publish.status = starting`
2. Publish pipeline starts → `publish.status = publishing`
3. Playback URL validated → `playback.status = ready`
4. `live_stream_state.is_live` updated → `playback.status = playback_pending`
5. Attendee manifest resolves → still pending
6. Player confirms playback → `playback.status = live`

The middle period is **normal**, not failure.

## Publish modes

| Mode | Use |
|------|-----|
| `external_hls` | Restream/CDN HLS URL already exists; owner opens attendee gate |
| `rtmp_encoder` | vMix program mix → Restream RTMP → attendee HLS. Owner console can ping vMix and send `StartStreaming` / `StopStreaming`. |

## vMix (production machine)

- Configure `VMIX_API_BASE_URL` on the **Next.js server** that can reach the vMix PC (usually `http://127.0.0.1:8088/api` when Next runs on the vMix machine).
- vMix handles cameras, lower thirds, audio buses, and the program mix.
- Restream receives **one** RTMP feed from vMix (cam man's URL + stream key in vMix settings — not in attendee env).
- `GET /api/owner/vmix/status` and the owner snapshot `vmix` field expose connection/streaming state.
- **Go Live (RTMP)** calls vMix `StartStreaming`, then opens the attendee gate.
| `browser_camera` | Direct WebRTC P2P via owner publisher session (rehearsal/small audience) |

Browser camera uses `POST /api/owner/publisher/session` and is **not** the Restream RTMP path.

## Dual-ingest failover (show day)

| Lane | Ingest | Env / DB |
|------|--------|----------|
| Primary | vMix → Restream RTMP → Restream HLS | `ATTENDEE_PLAYBACK_HLS_URL` → `primary_playback_url` |
| Backup | Owner Larix/OBS → Amazon IVS RTMP → IVS HLS | `ATTENDEE_BACKUP_HLS_URL` → `backup_playback_url` |

- `active_source` on `live_stream_state` controls which manifest `/api/stream/manifest` returns (`primary` | `backup`).
- `POST /api/owner/broadcast/switch-feed` flips the route while `is_live` stays true — does **not** end the show.
- `emitStreamStateSync()` notifies `/live` to re-fetch manifest immediately on failover.
- **Go Live (Camera)** is Lane C (WebRTC break-glass) — separate from HLS dual-ingest.

## Security

- Owner routes require authenticated email in `ADMIN_EMAILS`.
- Owner APIs never return RTMP ingest URLs or stream keys.
- `playback.hlsUrl` is the public manifest only.

## Attendee routing note

Attendee `/live` may merge schedule + broadcast flags for routing. The **owner console must always show all three axes separately.**
