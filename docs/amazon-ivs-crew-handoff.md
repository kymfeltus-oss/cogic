# Amazon IVS broadcast crew handoff

COGIC LIVE is the attendee playback application, not a video ingest server. The production signal path is:

`cameras → switcher / production system → encoder → Amazon IVS ingest → IVS channel → IVS playback HLS → cogiclive.com/live`

The workflow is encoder agnostic. vMix, OBS, TriCaster, hardware encoders, FFmpeg, and other professional systems may contribute when they support the protocol selected by the operator.

## Secure operator handoff

Only an authorized owner/broadcast operator distributes contribution credentials. Do not put stream keys, SRT passphrases, AWS credentials, or complete ingest connection strings in attendee HTML, React props, public APIs, logs, screenshots, tickets, or `NEXT_PUBLIC_*` variables.

For RTMPS, the operator provides the real IVS ingest server and stream key through an approved private channel. For SRT, the operator provides the real endpoint, port, stream ID, and passphrase. The application control room shows configuration status only; credential distribution remains a manual operator action.

Recommended baseline settings are H.264 video, AAC-LC audio, and an approximately two-second keyframe interval. Resolution, frame rate, and bitrate must match the configured IVS channel type and current Amazon IVS guidance.

## First-service acceptance checklist

1. Authorized operator enters the real IVS contribution details into the crew encoder.
2. Encoder connects successfully.
3. IVS console confirms input.
4. Program audio is confirmed.
5. Program video is confirmed.
6. Resolution, frame rate, bitrate, and keyframe interval are correct for the channel.
7. No severe dropped frames or sustained network loss is present.
8. The real IVS playback URL works; no sample or demo media is configured.
9. COGIC LIVE owner preflight passes all required checks.
10. `/live` remains offline until the authoritative broadcast state is activated.
11. `cogiclive.com/live` plays the real program feed after go-live.
12. Recording begins when recording is configured.
13. The real backup procedure is documented; otherwise backup is reported as `UNCONFIGURED`.
14. Stream keys and passphrases do not appear in public/client logs or preflight JSON.

External crew members do not need a COGIC LIVE application API key to send video. Their normal contribution credential is the IVS stream key for RTMPS/RTMP or the IVS SRT connection credential set.

## Vercel production configuration checklist

Enter these values in the Vercel project’s server-side Production environment. Never add a secret to a `NEXT_PUBLIC_*` variable.

| Value source | Environment variable |
| --- | --- |
| Primary provider selection (`ivs`) | `BROADCAST_PRIMARY_PROVIDER` |
| Amazon IVS channel name | `AWS_IVS_CHANNEL_NAME` |
| Amazon IVS channel ARN | `AWS_IVS_CHANNEL_ARN` |
| Selected contribution protocol (`rtmps` or `srt`) | `AWS_IVS_INGEST_PROTOCOL` |
| Amazon IVS RTMPS ingest server | `AWS_IVS_INGEST_SERVER` |
| Amazon IVS RTMPS stream key | `AWS_IVS_STREAM_KEY` |
| Existing IVS recording configuration (`true`) | `AWS_IVS_RECORDING_ENABLED` |
| Amazon IVS SRT endpoint, when SRT is selected | `AWS_IVS_SRT_ENDPOINT` |
| Amazon IVS SRT port, when SRT is selected | `AWS_IVS_SRT_PORT` |
| Amazon IVS SRT stream ID, when SRT is selected | `AWS_IVS_SRT_STREAM_ID` |
| Amazon IVS SRT passphrase, when required | `AWS_IVS_SRT_PASSPHRASE` |
| Optional approved backup playback URL | `ATTENDEE_BACKUP_HLS_URL` |

After saving, redeploy Production, open Owner Control, run encoder preflight, and verify `Crew Connection: Ready`. A configured recording profile reports configured while offline; it reports active only after the authoritative stream is live and playback is reachable.
