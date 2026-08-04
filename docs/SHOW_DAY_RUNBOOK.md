# PARABLE Broadcast Console v1.0 — Show Day Runbook

---

## Purpose

This runbook helps any trained operator run the live event safely and confidently on the **PARABLE Broadcast Console**.

You do not need to be a developer to use this document. Follow the steps in order, watch the panels on screen, and escalate to your **Production Lead** when something does not look right.

**Console location:** Open the PARABLE Broadcast Console after completing the email gate. Your team lead will provide the exact link for show day.

---

## Golden Rule

**Reliability beats innovation until after the event.**

Stick to the procedures you practiced in rehearsal. Do not experiment with new workflows, shortcuts, or untested ideas during the live show.

---

## Startup Procedure

Complete these steps before rehearsal or go-live. Do not rush.

### 1. Power on production hardware

- Turn on cameras, switcher/media core, audio, and network gear in the order your Production Lead specifies.
- Wait until all gear has finished booting before opening the console.

### 2. Open PARABLE Broadcast Console

- Open the broadcast console in your browser on the production machine.
- Confirm the page loads fully and shows **PARABLE Engine v1.0** in the top telemetry tray.

### 3. Complete email gate

- Enter your authorized email when prompted.
- If access is denied, stop and notify the Production Lead. Do not share credentials or bypass the gate.

### 4. Verify Media Core health

Look at the top telemetry tray for **Media Core** status:

| Status | Meaning |
|--------|---------|
| **MEDIA CORE CONNECTED** | Healthy — proceed |
| **MEDIA CORE DEGRADED** | Working but unstable — notify Production Lead before go-live |
| **MEDIA CORE DISCONNECTED** | Not ready — stop and escalate |

Also check **STREAM: STANDBY** and **REC: OFF** before the show (unless your lead instructs otherwise).

### 5. Verify required sources are present

- Open the **Media Sources** strip below the monitors.
- Confirm every camera and input needed for the show appears and shows **Online** (not **Offline**).
- If sources are missing, notify the Production Lead. Do not guess or force a switch.

### 6. Verify Distribution Network is ready

- Check the **Distribution Network** panel on the right side.
- Confirm required destinations show **Connected** (or **Live** only after you are on-air).
- If destinations are **Offline** or show errors, notify the Production Lead before go-live.

### 7. Verify Recording / Local Capture status

- In the telemetry tray, confirm **REC** status matches what your show plan requires.
- Before go-live, your lead will confirm whether recording should be **OFF** or **ACTIVE**.
- If the show is live and recording should be running but **REC** shows **OFF**, notify the Production Lead immediately.

### 8. Verify Readiness Gate

- Check the **Readiness Gate** panel (score and blocker count).
- **Readiness Gate Green** means the interlock is clear and you may go live when called (unless Rehearsal Mode is on — see below).
- If blockers appear, read the messages in **Production Safety Engine** and **Event Guardian**. Do not go live until the Production Lead clears or addresses them.

---

## Rehearsal Mode Procedure

Use Rehearsal Mode to practice without sending a real stream to the audience.

### 1. Turn on Rehearsal Mode

- In the top telemetry tray, click **Rehearsal Mode** to turn it on (yellow). Click again to turn it off (grayed out).

### 2. Confirm visible Rehearsal Mode indicator

- The **Rehearsal Mode** button in the telemetry tray should appear yellow when on.
- The Readiness Gate button should read **Simulate Go Live** (not **Go Live**).

### 3. Run Simulate Go Live

- When the Readiness Gate allows it, click **Simulate Go Live**.
- Confirm **STREAM: LIVE** appears in the tray for practice purposes only.
- Confirm **Program On-Air** treatment (red framing on the Program monitor when live).

### 4. Practice Preview → Program transitions

- Click a source in **Media Sources** to load it into **Preview** (blue framing).
- Confirm Preview shows the correct shot before taking it to Program.

### 5. Practice Take, Cut, Fade, Stinger

Use the hardware switcher below the monitors:

| Button | When to use in rehearsal |
|--------|--------------------------|
| **Take** | Standard transition to Program |
| **Cut** | Instant switch — use sparingly |
| **Fade** | Smooth dissolve |
| **Stinger** | Graphic/bumper transition — only when cued |

Practice slowly. One action, then wait for the result.

### 6. End Rehearsal

- Click **End Rehearsal** in the Readiness Gate when practice is complete.

### 7. Confirm real streaming did not start

- After ending rehearsal, confirm with your Production Lead that no real outbound stream went live.
- Turn **Rehearsal Mode** off (grayed out) before the actual show unless your lead says otherwise.

---

## Pre-Show Final Check

Complete this checklist with your Production Lead within 15 minutes of show time.

| Check | Confirm |
|-------|---------|
| **Sources ready** | All required inputs **Online** in Media Sources |
| **Preview working** | Selecting a source updates Preview correctly |
| **Program safe** | Program shows a safe wide or holding shot — never black or wrong content |
| **Distribution ready** | Distribution Network destinations **Connected** |
| **Recording ready** | **REC** status matches show plan |
| **Event Guardian quiet or acknowledged** | No unaddressed warnings in Production Safety Engine, or lead has signed off |
| **Readiness Gate Green** | Score acceptable, no unresolved **BLACK** blockers |
| **Supervisor present if override may be needed** | A named supervisor is available if a controlled bypass may be required |

**Rehearsal Mode must be OFF** for the real show unless your lead explicitly says otherwise.

---

## Go Live Procedure

Go live only when the **show lead** calls it — not on your own timing.

### 1. Verify Program monitor has the correct safe starting shot

- Program (larger monitor, right side) must show the approved opening shot.
- If Program is empty or wrong, fix Preview → Program before continuing.

### 2. Confirm Readiness Gate

- Readiness Gate must allow **Go Live** (button enabled, no **BLACK** hard blocks).
- Review any remaining warnings with the Production Lead.

### 3. Click Go Live only when show lead calls it

- Wait for the verbal or cue call: *"Go live."*
- Click **Go Live** once. Do not double-click.

### 4. Confirm Program On-Air

- Program monitor should show red live framing when on-air.
- **STREAM: LIVE** should appear in the telemetry tray.

### 5. Confirm stream / live status

- Check **Distribution Network** — destinations should move toward **Live** or **Connected** as expected.
- If status does not update within a reasonable moment, notify the Production Lead. Do not spam clicks.

### 6. Confirm recording / local capture

- Verify **REC: ACTIVE** if recording is required for this show.
- If recording should be on but is not, notify the Production Lead immediately.

---

## During Event Procedure

Your job is to keep the show stable and readable for the audience.

### Keep Program safe

- Never leave Program on a black, offline, or unintended source.
- When unsure, stay on the safest wide or holding shot.

### Use Preview before switching

- Always load the next shot in **Preview** first.
- Confirm it looks correct, then take it to Program.

### Use Take / Fade for smooth transitions

- **Take** and **Fade** are your default tools for normal segment changes.
- Move deliberately — one transition, then verify Program.

### Use Cut only when appropriate

- **Cut** is instant with no dissolve. Use only when the show lead or rundown calls for it.
- Avoid cuts during sensitive audio or mid-sentence unless directed.

### Watch Event Guardian

- The **Production Safety Engine** panel shows **Event Guardian** recommendations.
- Event Guardian **advises only** — it does not fix problems automatically.
- Read each message, follow the recommendation, or escalate if unsure.

### Watch Production Events panel

- The **Production Events** log at the bottom of the main column records what the system is doing.
- Newest entries appear at the top. Scan for **Critical** or **Hard Block** lines during the show.

### Avoid rapid repeated clicking

- One button press, then wait.
- Repeated clicking can cause confusion and makes troubleshooting harder.

### Escalate warnings calmly

- Tell the Production Lead what you see, what you did, and what the panel says.
- Stay on a safe Program shot while the issue is handled.

---

## Emergency Responses

Event Guardian and Production Safety Engine may surface these situations. Follow the steps below.

---

### Audio silence warning

**What you see:** Event Guardian or readiness checks report silent audio, or the audience would hear nothing.

**Do first:**

1. Stay on a safe Program shot.
2. Notify **Audio Operator** and **Production Lead** immediately.
3. Do not take new sources until audio is confirmed.

**Who to notify:** Audio Operator, Production Lead.

**Do not:**

- Go live or switch aggressively while audio is unknown.
- Mute or change levels from the console unless you are the assigned audio operator.

---

### Source / camera offline

**What you see:** A source shows **Offline** in Media Sources, or Preview/Program shows **No Source Selected**.

**Do first:**

1. Keep Program on the last good, safe shot.
2. Select a backup source in Preview if one is available.
3. Notify **Production Lead** and **Camera Operator**.

**Who to notify:** Production Lead, Camera Operator.

**Do not:**

- Take an offline or untested source to Program.
- Rapid-fire through every source hoping one works.

---

### Distribution degraded

**What you see:** Distribution Network shows errors, **Offline** destinations, or warnings about packet loss or uplink quality.

**Do first:**

1. Keep Program on a safe shot — the show can continue while distribution is investigated.
2. Notify **Production Lead** and **Stream Engineer** (or network lead).
3. Read the Event Guardian message for the recommended action.

**Who to notify:** Production Lead, Stream Engineer.

**Do not:**

- Stop Live unless the Production Lead calls for it.
- Change sources repeatedly — that does not fix distribution.

---

### Media Core degraded

**What you see:** **MEDIA CORE DEGRADED** or **MEDIA CORE DISCONNECTED** in the telemetry tray, or Event Guardian reports **Media Core Unhealthy**.

**Do first:**

1. Stay on the current safe Program shot if still on-air.
2. Stop taking new transitions until the lead advises.
3. Notify **Production Lead** and **Technical Director** immediately.

**Who to notify:** Production Lead, Technical Director.

**Do not:**

- Restart hardware or close the browser without lead approval.
- Assume the system will recover on its own — escalate early.

---

### Recording not active

**What you see:** Show is live but **REC: OFF** when recording should be running, or Event Guardian warns **Recording Off While Live**.

**Do first:**

1. Notify **Production Lead** immediately — do not wait until end of show.
2. Stay on Program; keep the show running unless directed otherwise.
3. Follow lead instructions to enable recording on the media core if that is your assigned role.

**Who to notify:** Production Lead.

**Do not:**

- Ignore the warning because "the stream looks fine."
- Stop Live without lead approval.

---

### BLACK hard block

**What you see:** Readiness Gate shows a **BLACK** or **Hard Block** condition. **Go Live** is disabled. Event Guardian or Production Safety Engine shows a hard stop (e.g., no program source, empty sources, severe distribution failure while live).

**Do first:**

1. Do **not** go live if blocked before show start.
2. If already live, stay on the safest possible Program shot.
3. Notify **Production Lead** immediately — only they can authorize next steps, including supervisor override where allowed.

**Who to notify:** Production Lead (required).

**Do not:**

- Attempt supervisor override for **BLACK** issues — override does not bypass hard blocks.
- Click **Go Live** repeatedly or bypass the gate through any other means.

---

## Supervisor Override Procedure

Supervisor override is a controlled exception for **non-BLACK** issues only.

### When it applies

- Readiness failures remain visible but the Production Lead decides the show must proceed.
- **BLACK** hard blocks cannot be overridden — the system will not allow go-live.

### How to apply

1. Production Lead confirms override is appropriate.
2. In the Readiness Gate, open **Supervisor Override**.
3. Enter a clear reason of **at least 8 characters** (e.g., *"Backup cam verified live on floor"*).
4. Click **Apply**.

### What override does and does not do

| Override does | Override does not |
|---------------|-------------------|
| Allows go-live when the lead accepts residual risk | Hide failures from the console |
| Records the reason in the production log | Fix audio, sources, or distribution automatically |
| Requires a named supervisor decision | Bypass **BLACK** hard blocks |

### After override

- Failures remain visible in Production Safety Engine, Event Guardian, and Production Events.
- The supervisor **owns the decision** — stay extra cautious and monitor all warnings.

---

## Stop Live Procedure

End the broadcast only when the **show lead** confirms the show is over.

### 1. Only stop when show lead confirms

- Wait for the call: *"Stop live"* or *"We're clear."*

### 2. Click Stop Live

- In the Readiness Gate, click **Stop Live** once.
- Do not double-click.

### 3. Confirm Program Standby

- Program red live framing should clear.
- **STREAM: STANDBY** should appear in the telemetry tray.

### 4. Confirm recording / local capture has safely ended

- Verify **REC** status matches end-of-show expectations (usually **OFF** after archive is secured).
- Confirm with Production Lead that local capture finished saving.

### 5. Do not close system until final status is confirmed

- Leave the console open until the Production Lead confirms stream ended, recording saved, and hardware shutdown sequence begins.

---

## Post-Event Procedure

After the audience feed has ended:

1. **Confirm stream ended** — **STREAM: STANDBY**, Distribution Network no longer **Live**.
2. **Confirm recording saved** — verify with Production Lead that ISO/archive files are accounted for.
3. **Note major issues** — write down any Event Guardian warnings, outages, or overrides while memory is fresh.
4. **Leave post-event reporting for review** — the production team may generate a post-event summary from production logs after show day. Operators do not need a report screen during the event.
5. **Do not build or expect new report tools before the next event** — reporting UI is out of scope during the event freeze.

Hand off notes to the Production Lead for the post-mortem.

---

## When In Doubt

- **Do not panic.**
- **Do not rapidly click controls.**
- **Keep a safe wide shot in Program.**
- **Read the latest Event Guardian message.**
- **Escalate to Production Lead.**
- **Protect the live audience experience first.**
- **Stay on the safest working shot until the issue is resolved.**

---

## Event Freeze Reminder

Until the event is fully complete and reviewed:

- **Reliability beats innovation.**
- **No additional feature work is authorized before the event.**

Only these changes are authorized:

- Critical bugs
- Stability fixes
- Performance fixes
- Operator clarity fixes
- Rehearsal-blocking issues

Operators should follow this runbook and rehearsed procedures — not request or test new console features on show day.

---

## Quick Reference — Panel Map

| Panel | Location | Purpose |
|-------|----------|---------|
| Telemetry tray | Top | Media Core, Rehearsal Mode, REC, STREAM, pipeline status |
| Preview / Program | Main top | Preview (left, blue) · Program (right, larger) |
| Hardware switcher | Below monitors | Take · Cut · Fade · Stinger |
| Media Sources | Main column | Select sources for Preview |
| Production Events | Main column (bottom) | Timestamped show log |
| Readiness Gate | Right sidebar | Score, Go Live / Stop Live, Supervisor Override |
| Production Safety Engine | Right sidebar | Readiness checks + Event Guardian |
| Distribution Network | Right sidebar | Outbound destination status |

---

*PARABLE Broadcast Console v1.0 — Show Day Runbook. For technical architecture details, see `services/broadcast/ARCHITECTURE.md`. For change policy during the event window, see `docs/EVENT_FREEZE_RULES.md`.*
