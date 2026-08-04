# Hybrid Live Hub: Essential Operational Strategy

> **Canonical doc** — supersedes informal chat pastes. Code-accurate as of June 2026.  
> **Status legend:** **IMPLEMENTED** · **PARTIAL** · **RUNBOOK** · **ROADMAP**

**Console URL (local dev):** [http://localhost:3000/ops/live-hub](http://localhost:3000/ops/live-hub)  
Requires `ADMIN_EMAILS`, viewport ≥ 1280px, Next dev server on the machine that can reach vMix.

---

## Hybrid operational overview

This strategy outlines a streamlined hybrid lifecycle: **local hardware production** (vMix) + **global cloud distribution** (Restream) + **attendee platform** (300 Awakening `isLive` / HLS). Production quality is centered in the **Mix** inside vMix; the Live Hub **gates and orchestrates** — it does not replace the vMix mixer.

**Core references**

- [vMix Audio Basics (YouTube)](https://www.youtube.com/watch?v=tVYzbXprexA)
- [vMix Mixer](https://www.vmix.com/help25/Mixer.html)
- [vMix Mix](https://www.vmix.com/help25/Mix.html)
- [vMix Web Controller](https://www.vmix.com/help25/WebController.html)
- [vMix Developer API](https://www.vmix.com/help25/DeveloperAPI.html)
- [Restream Developers](https://developers.restream.io)

---

## Phase I: Physical & local connectivity — **RUNBOOK**

Before the console can manage the event, bridge the operator environment to vMix.

### Ethernet connection (primary — encoder / vMix PC)

For the **vMix / encoder PC**, prefer wired Ethernet over Wi‑Fi for stream stability:

- Use **CAT6** where possible; **CAT5e** minimum.
- Connect PC **RJ45** → router/switch **LAN** port (often yellow or labeled LAN).
- Windows typically prefers Ethernet over Wi‑Fi when both are active. To force priority: *Network Connections → Advanced → set Ethernet interface metric to **1*** (lowest wins). [15–19]

### Wireless infrastructure (tablets / phones — control surfaces)

For mobile operator control on the same LAN:

- Use **5 GHz or 6 GHz**; avoid congested **2.4 GHz** for control traffic.
- Prefer **Wi‑Fi 6/7** in dense environments.
- **SSID isolation:** distinct SSIDs for 5 GHz and 6 GHz to reduce band-hopping.
- **Range:** stay within strong signal; 5/6 GHz does not penetrate walls like 2.4 GHz. [1–7]

See **Phase IX** for step-by-step Ethernet/Wi‑Fi setup on the operator machine. See **Phase X** to verify the LAN bridge from a phone or tablet.

### vMix & Next.js bridge

- **vMix API:** enable [Web Controller](https://www.vmix.com/help25/WebController.html), typically port **8088**. [8, 9]
- **Same LAN:** operator Next server and vMix should share a network path (local LAN or mesh VPN).
- **Permissions:** enable *Allow software on this computer access without login* in vMix.
- **IP binding:** bind Next dev server to **`0.0.0.0`** only if you need the console UI from tablets on Wi‑Fi.

**Default (recommended):** run `npm run dev` (or production Node) **on the vMix machine** with `VMIX_API_BASE_URL=http://127.0.0.1:8088/api`. No tunnel required.

**If Next is hosted remotely** (e.g. Vercel), see **Phase VIII** — `127.0.0.1` will not work from the server.

---

## Phase II: Software environment & environment variables — **IMPLEMENTED**

Configuration is driven by `.env.local`:

| Variable | Purpose | Status |
|----------|---------|--------|
| `VMIX_API_BASE_URL` | e.g. `http://127.0.0.1:8088/api` | **IMPLEMENTED** |
| `RESTREAM_API_TOKEN` | Channel PATCH + telemetry (mock if unset) | **IMPLEMENTED** |
| `RESTREAM_PRIMARY_CHANNEL_IDS` | Optional; defaults to all channels on go-live | **IMPLEMENTED** |
| `ADMIN_EMAILS` | Ops access — avoids `requireOpsAdminUser()` 404 | **IMPLEMENTED** |
| `ADMIN_SECRET_KEY` | Required for `/api/stream/toggle` (go-live step 3) | **IMPLEMENTED** |

- **Ready logic (IMPLEMENTED):** The 9-card readiness panel and go-live decision run **client-side** in `LiveHubConsole.tsx` and `lib/live-hub/safety.ts` for real-time responsiveness.
- **Dev override (IMPLEMENTED):** Shift+click the Upload card locks **20 Mbps** and pauses background upload polling until a normal re-test clears it.

**Architecture note:** `app/ops/live-hub/page.tsx` server-loads `initialSnapshot` only. Readiness is **not** fully server-rendered (do not claim otherwise).

**Optional learning (not app dependencies)**

- [Restream API walkthrough (YouTube)](https://www.youtube.com/watch?v=TsMGIdKsikw&t=25)
- [How to Go Live on Restream (YouTube)](https://www.youtube.com/watch?v=UldCFAh_wSM&vl=en)

---

## Phase III: The Mix (core production in vMix) — **RUNBOOK**

The Mix is where the broadcast comes together — configured **in vMix**, not in the web UI:

- **Video Mix inputs (1–4):** e.g. Mix 1 = program, Mix 2 = clean ISO/recording.
- **Audio bus routing (A–G):** mix-minus for operator monitoring without delayed self-feedback.
- **Auto-mixing:** enable **Follow** so audio swaps with program transitions.

---

## Phase IV: The data layer (information flow)

Start-to-finish telemetry the console uses — with honest implementation status.

### 1. Local hardware telemetry (vMix) — **PARTIAL**

Retrieved server-side: `GET /api/ops/live-hub/vmix` → `VMIX_API_BASE_URL` XML.

| Data point | Status | What the app does today |
|------------|--------|-------------------------|
| Version check | **IMPLEMENTED** | Requires `<version>` or `<inputs>` in XML (valid instance) |
| Streaming status | **PARTIAL** | Parses `<streaming>True</streaming>` — **not** `channel1`/`channel2` attrs yet |
| Active / preview / recording | **IMPLEMENTED** | Parsed from XML |
| Audio master meters | **PARTIAL** | Gate uses `audioMasterLevel`; **live adapter uses placeholder 65** until real meter XML is parsed (not 0–1 amplitude from vMix yet) |

### 2. Cloud distribution telemetry (Restream) — **IMPLEMENTED** (when token set)

REST + ~4s WebSocket snapshot (`lib/live-hub/restream/adapter.ts`).

| Data point | Status | Threshold |
|------------|--------|-----------|
| Ingest bitrate | **IMPLEMENTED** | ≥ 5000 kbps healthy; &lt; 4500 kbps **degraded** |
| Channel health | **IMPLEMENTED** | Outgoing `CONNECTED` / `DISCONNECTED` + channel `active` |
| Frame cadence (FPS) | **ROADMAP** | Present in WebSocket frames; not in UI or gates yet |

### 3. Local diagnostic telemetry — **IMPLEMENTED**

| Data point | Source |
|------------|--------|
| Upload speed | Browser Network Information API; gates go-live |
| Mic fallback | Web Audio analyser if vMix master silent |
| Self-heal | Worker `RECONSTRUCT_GAIN_INPUTS` after ≥3s silence → pink `[Self-Heal]` logs |

---

## Phase V: Essential pre-flight gate — **IMPLEMENTED**

Critical hybrid blockers (subset of the full 9-card panel). The UI card IDs are shown for cross-reference.

| Check category | Essential condition | App card | Actually need status |
|----------------|-------------------|----------|----------------------|
| The Mix | Active signal on master bus | `audio_input` | **PARTIAL** — placeholder `audioMasterLevel` (65) until real vMix meter XML; local mic fallback **IMPLEMENTED** |
| Encoder | API version / inputs in XML | `encoder_vmix` | **IMPLEMENTED** — click to ping vMix; stale state cleared on failure |
| Restream | Channel tokens + telemetry | Restream + `backup_systems` | **IMPLEMENTED** — REST + WebSocket when token set |
| Upload speed | ≥ 10 Mbps ready | `upload_speed` | **IMPLEMENTED** — browser estimate; warn 5–10 · fail &lt;5 |

Full go-live modal also runs `evaluateGoLiveDecision()` (HLS `.m3u8`, cameras, Stripe, content/team, etc.).

**Verification**

- `node lib/live-hub/verify-pure.mjs` — isolated upload / manifest / encoder gates (**5/5**).
- Scenarios **A, D, E** share `https://edge.cdn.com/live/main.m3u8` — each gate blocks independently.
- **Dev override:** Shift+click Upload → 20 Mbps; background poll pauses while locked.

---

## Phase VI: Go-live execution — **IMPLEMENTED**

**Trigger:** Confirm & Go Live → `POST /api/ops/live-hub/go-live` → `lib/live-hub/go-live/execute.ts`

1. **Restream activation** — PATCH channels `active: true` ([Restream channel update](https://developers.restream.io/channels/channel-update))
2. **Hardware ignition** — vMix `StartStreaming`
3. **Platform launch** — `/api/stream/toggle` → `isLive: true`, primary lane

**Ordered sequence with rollback** (not a single atomic transaction):

| Failure | Automated response |
|---------|-------------------|
| Step 2 (vMix) fails | `deactivateRestreamChannels()` — step 1 channels set `active: false` |
| Step 3 (platform) fails | Best-effort vMix `StopStreaming`, then Restream deactivate |

Error messages note whether Restream rollback succeeded.

---

## Phase VII: Live monitoring & termination — **IMPLEMENTED** (partial)

Once execution succeeds, the console enters active monitoring:

| Feature | Status |
|---------|--------|
| Live timer | **IMPLEMENTED** — `On Air · HH:MM:SS` in status strip |
| Self-healing logs | **IMPLEMENTED** — ≥3s silence → `[Self-Heal]` |
| Stop Stream confirmation | **IMPLEMENTED** — **End Broadcast?** modal; Cancel = no API call; Confirm Stop → `handleStopStream()` |
| Termination | **IMPLEMENTED** — vMix stop → platform offline → Pre-Live summary |
| Dedicated live-only UI shell | **ROADMAP** — today: nav switches to Stream Setup |

---

## Phase VIII: Global hardware bridge (blocked encoder on hosted Next) — **RUNBOOK**

If the **Encoder & Software** card stays pink while vMix runs locally, the usual cause is: your **Next.js server** (where `/api/ops/live-hub/vmix` runs) cannot reach `127.0.0.1:8088` — that address always means “this machine,” not your vMix PC.

The browser never calls vMix directly; the **server adapter** fetches `VMIX_API_BASE_URL`. Fix the URL the **server** can reach.

### Option A — Recommended (no bridge)

Run the Live Hub on the **same machine as vMix** (or a LAN peer):

```env
VMIX_API_BASE_URL=http://127.0.0.1:8088/api
```

Console: [http://localhost:3000/ops/live-hub](http://localhost:3000/ops/live-hub)

### Option B — Tailscale mesh VPN — **RUNBOOK**

- Install Tailscale on the vMix PC and on the machine **running Next.js** (if not the same box).
- Use the vMix host’s **Tailscale IP** from the Next server:

```env
VMIX_API_BASE_URL=http://100.x.x.x:8088/api
```

**Note:** A default **Vercel** deployment is **not** on your tailnet. Tailscale helps when Next runs on an operator laptop, studio NUC, or self-hosted Node on the mesh — not as a magic fix for serverless alone unless you add Tailscale Funnel/Serve on the vMix side.

### Option C — ngrok tunnel (quickest remote test) — **RUNBOOK**

On the vMix machine:

```bash
ngrok http 8088
```

Set on the machine/environment **running Next**:

```env
VMIX_API_BASE_URL=https://YOUR-SUBDOMAIN.ngrok-free.app/api
```

**Caveats:** tunnel must stay up for the whole show; free tiers rotate URLs; treat as rehearsal/dev unless you use a stable paid endpoint.

### Verify ready state

1. Update `VMIX_API_BASE_URL` and restart Next.
2. In the console, click **Encoder & Software** (click to ping vMix).
3. Server receives XML with `<version>` or `<inputs>` → card flips **Ready** (blue). Failure clears stale state → **Blocked** (pink).

---

## Phase IX: Step-by-step connection walkthrough (Wi‑Fi & Ethernet) — **RUNBOOK**

Follow these steps on the **operator / vMix machine** to establish the hybrid network bridge.

**Windows networking references**

- [Windows 11 Wi‑Fi adapter disappeared (Microsoft Q&A)](https://learn.microsoft.com/en-us/answers/questions/3839979/windows-11-wi-fi-adapter-disappeared)
- [Wi‑Fi not working in Windows 11 (YouTube)](https://www.youtube.com/watch?v=4GUsLT6FKFc)
- [Network profile type missing from GUI (Super User)](https://superuser.com/questions/1719469/network-profile-type-public-private-missing-from-gui-settings-in-windows-11)
- [Adapter priority changes in Windows 11 (ElevenForum)](https://www.elevenforum.com/t/setting-network-adapter-priority-no-longer-works-in-windows-11.19467/)

### Step 1: Physical Ethernet connection

1. **Select cable:** Use **CAT6** for 1 Gbps stability; **CAT5e** minimum.
2. **Plug in:** Router/switch **LAN** port → PC **RJ45** until it clicks.
3. **Verify hardware:** In *Device Manager*, confirm **Gigabit Ethernet Controller** is listed with no warning icons.

### Step 2: High-bandwidth Wi‑Fi setup

1. **Connect:** Taskbar network icon → choose your **5 GHz or 6 GHz** broadcast-optimized SSID (e.g. `Broadcast_5GHz`).
2. **Force 5 GHz priority:** *Device Manager → Network adapters → [your Wi‑Fi card] → Advanced → Preferred band → **Prefer 5 GHz band***. [23, 24]

### Step 3: Set hardware priority (interface metric)

Windows should prefer Ethernet when both links are up. To force it:

1. **PowerShell (Administrator):** First list adapters — names vary (`Ethernet`, `Ethernet 2`, vendor labels):

   ```powershell
   Get-NetIPInterface -AddressFamily IPv4 | Sort-Object InterfaceMetric | Format-Table InterfaceAlias, InterfaceMetric
   ```

2. Set the **lowest** metric on your wired adapter (example — replace alias if needed):

   ```powershell
   Set-NetIPInterface -InterfaceAlias "Ethernet" -InterfaceMetric 1
   ```

3. **Verify:** Re-run `Get-NetIPInterface` — Ethernet should have the lowest `InterfaceMetric`. [20–22]

**GUI alternative:** *Network Connections → Advanced → set Ethernet interface metric to **1***.

### Step 4: Bonding (optional)

Tools like [Speedify](https://speedify.com/blog/better-streaming/streaming-setup-content-creators-remote-workers/) can bond Ethernet + Wi‑Fi for failover. **RUNBOOK** only — not integrated into the Live Hub app. [25, 26]

After Steps 1–3, run **Phase X** to confirm phones/tablets can reach vMix on port **8088**.

---

## Phase X: Wi‑Fi connectivity test — **RUNBOOK**

Verify your local bridge so the dashboard and mobile control devices can reach vMix on the LAN.

### 1. Verify the same network

- PC and mobile device (phone/tablet) must use the **same Wi‑Fi SSID**.
- **Do not** use guest Wi‑Fi — guest networks often block device-to-device traffic.

### 2. Find your PC’s local IP

1. On the vMix PC: **Win + R** → `cmd` → Enter.
2. Type `ipconfig` → Enter.
3. Note **IPv4 Address** under your active adapter (e.g. `192.168.1.15`).
4. **Shortcut:** vMix → **Settings → Web Controller** also shows the bound address.

### 3. Open the bridge on your phone

1. On phone/tablet, open Chrome or Safari.
2. Navigate to `http://YOUR_IPV4:8088` (e.g. `http://192.168.1.15:8088`).
3. **Success:** vMix Web Controller loads.

This test validates **LAN reachability** to vMix. The Live Hub console still reaches vMix via the **Next server** at `VMIX_API_BASE_URL` — run Phase VIII only if that server is not on the same machine/LAN.

### 4. Troubleshooting (if it fails)

| Symptom | Fix |
|---------|-----|
| Page never loads | vMix → **Settings → Web Controller** → **Enabled** checked |
| Login prompt / blocked | Enable **Allow software on this computer access without login** |
| Timeout on phone only | Windows Firewall — add inbound rule for **vMix** or TCP **8088** |
| Works on PC, not phone | Confirm same SSID; disable guest/isolation on router |

---

## Operator cheat sheet

| Action | Result |
|--------|--------|
| Open console | `/ops/live-hub` |
| Confirm & Go Live | Restream → vMix → attendee platform |
| Stop Stream → Confirm Stop | vMix stop → platform offline |
| Shift + click Upload | 20 Mbps dev override |
| Click Encoder | `refreshVmix()`; stale ready cleared on failure |
| Phase X phone test | `http://YOUR_IPV4:8088` → vMix Web Controller |
| `verify-pure.mjs` | 5/5 isolated logic gates |

---

## Placeholders — **ROADMAP**

Manage Plan · Sidebar tools (Teleprompter, Music Player, Shed Rooms) · Invite Team · Real vMix audio meters · Restream FPS in UI · Per-channel vMix streaming attrs

---

## Further reading (Wi‑Fi & network)

[1] [RingPlanet — streaming internet](https://ringplanet.com/best-streaming-internet/)  
[2] [Ezurio — Wi‑Fi 6 vs 6E](https://www.ezurio.com/resources/blog/wi-fi-6-vs-wi-fi-6e-a-comprehensive-comparison)  
[3] [CenturyLink — frequency choice](https://www.centurylink.com/home/help/internet/wireless/which-frequency-should-you-use.html)  
[4] [BroadbandNow — Wi‑Fi frequency guide](https://broadbandnow.com/guides/which-wi-fi-frequency-should-you-use)  
[5] [PCMag — router optimization](https://www.pcmag.com/how-to/how-to-set-up-and-optimize-your-wireless-router-for-the-best-wi-fi-performance)  
[6] [NVIDIA Omniverse — network setup](https://docs.omniverse.nvidia.com/avp/latest/setup-network.html)  
[7] [PCMag — best routers](https://www.pcmag.com/picks/the-best-wireless-routers)  
[8] [vMix Web Controller](https://www.vmix.com/help25/WebController.html)  
[9] [vMix networking (YouTube)](https://www.youtube.com/watch?v=AItWzHGMu5k&t=6)

### Ethernet & bonding

[15] [Speedify — wireless streaming best practices](https://speedify.com/blog/how-to/best-practices-live-streaming-on-wireless-connection/)  
[16] [vMix forums — internal network streams](https://forums.vmix.com/posts/t9655-rtsp-stream--multicast--over-internal-network)  
[17] [Highlands Fiber — connect streaming device](https://www.highlandsfibernetwork.com/user-guide/connect-streaming-device)  
[18] [Reddit — router LAN sharing](https://www.reddit.com/r/HomeNetworking/comments/sbn1dy/can_wifi_routersmodems_share_internet_through/)  
[19] [PLC training — Ethernet basics](https://www.myplctraining.com/blog/connecting-to-allen-bradley-plcs-ethernet)  
[20] [Reddit — Wi‑Fi + Ethernet same time](https://www.reddit.com/r/VIDEOENGINEERING/comments/viww7u/how_do_i_use_wifi_and_ethernet_at_the_same_time/)  
[21] [Reddit — turn off Wi‑Fi when on Ethernet?](https://www.reddit.com/r/HomeNetworking/comments/1q4ru2m/do_you_turn_off_wifi_when_using_the_ethernet_cable/)  
[22] [Reddit — dual connection](https://www.reddit.com/r/VIDEOENGINEERING/comments/viww7u/how_do_i_use_wifi_and_ethernet_at_the_same_time/)  
[23] [YouTube — prefer 5 GHz](https://www.youtube.com/watch?v=xXa7O2-B85M)  
[24] [YouTube — Wi‑Fi band lock](https://www.youtube.com/watch?v=kmhe8Vg98cU)  
[25] [Speedify — creator streaming setup](https://speedify.com/blog/better-streaming/streaming-setup-content-creators-remote-workers/)  
[26] [YouTube — bonded connections overview](https://www.youtube.com/watch?v=GoLXv9ajPdQ)
