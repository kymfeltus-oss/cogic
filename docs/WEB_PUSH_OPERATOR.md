# COGIC LIVE — Web Push Operator Guide

Never paste private keys into tickets, chat, or commits.

## Required production environment names

| Name | Role |
|---|---|
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Public key (browser-safe via `/api/push/vapid-public-key`) |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Private key — **server only** |
| `WEB_PUSH_VAPID_SUBJECT` | Optional `mailto:` contact identity |
| `CRON_SECRET` | Protects reminder cron route |

## Generate one production keypair

```bash
npx web-push generate-vapid-keys
```

Store the public/private values in Vercel Production env vars once. Do not regenerate on each deploy.

## Schedule reminder execution

- Attendee sets **Remind Me** on `/program`
- Records persist in `schedule_reminders`
- Vercel Cron hits `GET /api/cron/process-reminders` every minute with `Authorization: Bearer $CRON_SECRET`
- Due reminders send Web Push and write `notification_deliveries`

## Acceptance checklist

1. Production VAPID + CRON_SECRET configured
2. Redeploy production
3. Attendee: Stay Connected → Turn On Notifications
4. Owner: publish announcement with Device Push
5. Confirm real device receipt
6. Encoder OFFLINE→LIVE → confirm one live-start push
