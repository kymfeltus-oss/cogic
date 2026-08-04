# PARABLE Event Freeze Rules

**Status:** Active during live-event preparation, rehearsal, and broadcast windows.  
**Scope:** PARABLE Broadcast Console (`/dashboard/broadcast`), live hub ops surfaces, adapters, and all paths that touch the Sacred Media Path.

---

## The PARABLE Event Freeze Rule

During an active event window, **reliability beats innovation**. The production stack is frozen at its approved architecture and behavior until the event concludes and a formal post-event review is complete.

The goal is simple: **ship a stable show**. Every change must reduce risk to operators, viewers, and the stream—not introduce new surface area.

---

## Reliability Over Innovation

Until after the event:

- Prefer **proven behavior** over new capabilities.
- Prefer **small, reversible diffs** over broad refactors.
- Prefer **observability and guardrails** over automation that can act without operator intent.
- Treat `services/broadcast/ARCHITECTURE.md` as the contract baseline; do not drift from locked boundaries without explicit post-freeze approval.

If a change does not clearly improve live reliability or operator safety, **do not merge it during the freeze**.

**No additional feature work is authorized before the event.**

Only:

- Critical bugs
- Stability fixes
- Performance fixes
- Operator clarity fixes
- Rehearsal-blocking issues

---

## Allowed Changes

The following are permitted when they are narrowly scoped and verified:

| Category | Examples |
|----------|----------|
| **Critical bug fixes** | Snapshot 500s, command failures, incorrect live/standby state, adapter handshake regressions |
| **Stability fixes** | Crash loops, race conditions, unhandled null states, reconnect logic |
| **Performance fixes** | Poll latency, unnecessary re-renders, hydration cost—without altering Sacred Media Path semantics |
| **Label clarity** | Operator-facing copy that reduces confusion (no behavior change) |
| **Rehearsal-blocking fixes** | Issues that prevent simulate go-live, rehearsal toggles, or readiness evaluation |
| **Readiness / safety / logging visibility fixes** | Readiness gate accuracy, Production Safety Engine recommendations, `productionLog[]` visibility, telemetry tray accuracy |

**Verification expectation:** Run `npm run test:broadcast` after service-layer changes. Confirm snapshot and command routes behave as documented in `services/broadcast/ARCHITECTURE.md`.

---

## Blocked Changes

Do **not** implement these during the event freeze:

| Category | Rationale |
|----------|-----------|
| **New product features** | Adds untested behavior under live pressure |
| **Architecture refactors** | High blast radius; violates frozen v1.0 boundaries |
| **Experimental automation** | Unpredictable side effects during go-live |
| **AI / video processing** | CPU/GPU/network load and failure modes are unacceptable mid-event |
| **New dashboard sections** | Unless strictly required for event safety (readiness, safety, logging)—no new panels, tabs, or workflows |

Cosmetic redesigns, marketing copy experiments, and "nice to have" telemetry are also out of scope unless they are label-clarity-only with zero behavioral impact.

---

## Sacred Media Path

The Sacred Media Path is the end-to-end chain from source selection through distribution. **Treat every step as production-critical.** Changes here require the highest bar of approval and testing.

```
Sources → Preview → Program → Recording → Streaming → Go Live → Stop Live → Distribution
```

| Stage | What it covers |
|-------|----------------|
| **Sources** | Input registry, adapter ingest, source selection (`set_preview`) |
| **Preview** | Pre-air monitor, preview bus state |
| **Program** | On-air bus, TAKE/CUT/FADE/STINGER transitions |
| **Recording** | Local or routed record paths tied to program output |
| **Streaming** | Encoder / outbound stream health and state |
| **Go Live** | `go_live` command, readiness interlock, rehearsal vs production paths |
| **Stop Live** | `stop_live` / end-live teardown, graceful shutdown |
| **Distribution** | Restream, multicast, relay, and downstream destinations |

**Default rule:** Stay **outside** the Sacred Media Path unless a fix is absolutely necessary and cannot be achieved elsewhere.

Protected implementation areas (non-exhaustive):

- `services/broadcast/ProductionBrain.ts`
- `services/broadcast/adapters/*`
- `POST /api/broadcast/command` supported actions: `set_preview`, `transition`, `go_live`, `stop_live`
- `services/broadcast/ReadinessEngine.ts` launch interlocks
- Preview / Program UI in `components/broadcast/PreviewProgram.tsx` and hardware switcher flows

---

## Change Approval Filter

Before proposing or merging any change during the freeze, answer **all five** questions. If any answer is unfavorable, **defer the change** until after the event.

1. **Does it improve operator experience?**  
   Reduces confusion, speeds recovery, or makes status unambiguous—not vanity UI.

2. **Does it improve reliability?**  
   Fewer failures, clearer failure modes, or faster detection—not new moving parts.

3. **Does it add minimal CPU / GPU / network load?**  
   No heavy client work, no new polling storms, no video/AI pipelines on the critical path.

4. **Can it fail without affecting the live stream?**  
   Failures must be isolated (logging, secondary panels, non-critical telemetry). Sacred Media Path failures are unacceptable.

5. **Does it stay outside the Sacred Media Path unless absolutely necessary?**  
   If the change touches Sources → Distribution, document why no safer alternative exists and require explicit operator sign-off.

---

## Related Documents

- `services/broadcast/ARCHITECTURE.md` — Frozen v1.0 architecture and verification commands
- `.cursor/rules/parable-event-freeze.mdc` — Cursor agent enforcement summary

---

## After the Event

When the live window closes:

1. Capture a post-event report from production logs and snapshots.
2. Triage deferred features and refactors in a dedicated post-mortem.
3. Lift the freeze only after explicit approval—not automatically.
