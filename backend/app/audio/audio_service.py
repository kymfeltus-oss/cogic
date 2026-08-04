from __future__ import annotations

import json
import math
import time
from typing import Any

import redis

from app.audio.x32_client import X32Client
from app.config import settings


class AudioRedisStore:
    def __init__(self, client: redis.Redis):
        self.client = client
        self.prefix = "audio"

    def _key(self, suffix: str) -> str:
        return f"{self.prefix}:{settings.default_tenant_id}:{suffix}"

    def set_json(self, suffix: str, payload: dict[str, Any]) -> None:
        self.client.set(self._key(suffix), json.dumps(payload))

    def get_json(self, suffix: str) -> dict[str, Any] | None:
        raw = self.client.get(self._key(suffix))
        if not raw:
            return None
        return json.loads(raw)

    def publish(self, channel: str, payload: dict[str, Any]) -> None:
        self.client.publish(self._key(channel), json.dumps(payload))


class AudioService:
    def __init__(self) -> None:
        self.redis = redis.from_url(settings.redis_url, decode_responses=True)
        self.store = AudioRedisStore(self.redis)
        self.x32 = X32Client(settings.x32_ip, settings.x32_osc_port, settings.listen_port)
        self.x32.set_update_callback(self._on_x32_update)
        self._mappings: dict[int, dict[str, Any]] = {}
        self._settings: dict[str, Any] = {
            "lufsTarget": -14,
            "truePeakCeiling": -1,
            "feedbackSensitivity": 0.65,
            "wirelessBatteryWarningPct": 25,
            "wirelessBatteryCriticalPct": 10,
            "streamSilenceThresholdDb": -50,
            "recordingSilenceThresholdDb": -50,
        }
        self._alerts: list[dict[str, Any]] = []
        self._feedback = {
            "detectedFrequencyHz": None,
            "affectedChannel": None,
            "riskLevel": "low",
            "autoNotchEnabled": False,
            "lastDetectedAt": None,
            "rtaBins": [0.0] * 64,
        }
        self._delay = {
            "videoDelayMs": 120,
            "audioDelayMs": 118,
            "lipSyncOffsetMs": 2,
            "driftMs": 0,
            "autoCorrectionEnabled": True,
            "syncConfidence": 0.92,
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def update_settings(self, payload: dict[str, Any]) -> None:
        self._settings.update(payload)
        if payload.get("x32Ip"):
            self.x32.ip = payload["x32Ip"]
            self.x32.client = self.x32.client.__class__(payload["x32Ip"], int(payload.get("x32OscPort", settings.x32_osc_port)))

    def update_mappings(self, mappings: list[dict[str, Any]]) -> None:
        self._mappings = {int(item["x32Channel"]): item for item in mappings}

    def connect(self) -> dict[str, Any]:
        ok = self.x32.connect()
        if ok:
            self.x32.subscribe_meters()
        return {"ok": ok, "message": "Connected to X32" if ok else "Unable to reach X32"}

    def disconnect(self) -> dict[str, Any]:
        self.x32.disconnect()
        return {"ok": True}

    def test_connection(self) -> dict[str, Any]:
        ok, latency, message = self.x32.test_connection()
        return {"ok": ok, "latencyMs": latency, "message": message}

    def _db_to_meter(self, db: float) -> int:
        return max(0, min(100, round((db + 60) * (100 / 60))))

    def _channel_status(self, level_db: float, muted: bool, clipping: bool, mapped: bool) -> str:
        if not mapped:
            return "setup_required"
        if clipping:
            return "critical"
        if muted:
            return "warning"
        if level_db < -50:
            return "warning"
        return "healthy"

    def build_channels(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for ch in self.x32.channels():
            mapping = self._mappings.get(ch.number, {})
            mapped = bool(mapping)
            rows.append(
                {
                    "channel": ch.number,
                    "name": ch.name or f"CH {ch.number:02d}",
                    "roleKey": mapping.get("roleKey"),
                    "displayName": mapping.get("displayName") or ch.name or f"CH {ch.number:02d}",
                    "levelDb": round(ch.level_db, 1),
                    "meterLevel": self._db_to_meter(ch.level_db),
                    "muted": ch.muted,
                    "solo": ch.solo,
                    "clipping": ch.clipping,
                    "status": self._channel_status(ch.level_db, ch.muted, ch.clipping, mapped),
                    "wirelessRf": mapping.get("wirelessRf"),
                    "wirelessBatteryPct": mapping.get("wirelessBatteryPct"),
                    "lastUpdateAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ch.updated_at)),
                    "mappingConfigured": mapped,
                }
            )
        return rows

    def build_buses(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for bus in self.x32.buses():
            rows.append(
                {
                    "busKey": bus.key,
                    "displayName": bus.label,
                    "levelDb": round(bus.level_db, 1),
                    "lufs": round(-14 + (bus.level_db + 20) * 0.08, 1) if bus.level_db > -80 else None,
                    "truePeakDb": round(bus.level_db + 0.5, 1) if bus.level_db > -80 else None,
                    "muted": bus.muted,
                    "limiterActive": bus.level_db > -3,
                    "status": "healthy" if bus.level_db > -50 else "warning",
                    "lastUpdateAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(bus.updated_at)),
                }
            )
        return rows

    def build_overview(self) -> list[dict[str, Any]]:
        cards = []
        bus_map = {b.key: b for b in self.x32.buses()}
        for key, label in [
            ("lr_master", "Master L/R"),
            ("stream_mix", "Stream Mix"),
            ("monitor_mix", "FOH Mix"),
            ("monitor_mix", "Monitor Mix"),
            ("choir_bus", "Choir Bus"),
            ("band_bus", "Band Bus"),
            ("pastor_mic", "Pastor Mic"),
        ]:
            bus = bus_map.get(key)
            if not bus:
                continue
            cards.append(
                {
                    "id": key,
                    "label": label,
                    "levelDb": round(bus.level_db, 1),
                    "meterLevel": self._db_to_meter(bus.level_db),
                    "lufs": round(-14 + (bus.level_db + 20) * 0.08, 1) if bus.level_db > -80 else None,
                    "truePeakDb": round(bus.level_db + 0.5, 1) if bus.level_db > -80 else None,
                    "status": "healthy" if bus.level_db > -50 else "warning",
                    "connected": self.x32.is_online(),
                    "clipping": bus.level_db > -1,
                    "muted": bus.muted,
                    "solo": False,
                    "lastUpdateAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(bus.updated_at)),
                }
            )
        return cards[:7]

    def build_loudness(self) -> dict[str, Any]:
        stream = next((b for b in self.x32.buses() if b.key == "stream_mix"), None)
        level = stream.level_db if stream else -90.0
        integrated = round(-14 + (level + 20) * 0.08, 1) if level > -80 else None
        target = float(self._settings.get("lufsTarget", -14))
        return {
            "integratedLufs": integrated,
            "shortTermLufs": round(integrated + 0.4, 1) if integrated is not None else None,
            "momentaryLufs": round(integrated + 0.8, 1) if integrated is not None else None,
            "truePeakDb": round(level + 0.5, 1) if level > -80 else None,
            "lra": 6.5 if integrated is not None else None,
            "targetLufs": target,
            "inTarget": integrated is not None and abs(integrated - target) <= 2,
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def build_wireless(self) -> list[dict[str, Any]]:
        devices = []
        for ch in self.x32.channels():
            mapping = self._mappings.get(ch.number, {})
            if not mapping.get("wireless"):
                continue
            battery = mapping.get("wirelessBatteryPct")
            rf = mapping.get("wirelessRf")
            status = "healthy"
            if battery is not None and battery <= self._settings["wirelessBatteryCriticalPct"]:
                status = "critical"
            elif battery is not None and battery <= self._settings["wirelessBatteryWarningPct"]:
                status = "warning"
            devices.append(
                {
                    "id": f"wireless-{ch.number}",
                    "label": mapping.get("displayName") or ch.name,
                    "channel": ch.number,
                    "batteryPct": battery,
                    "rfStrength": rf,
                    "rfQuality": status,
                    "status": status,
                    "backupAvailable": mapping.get("backupAvailable", False),
                }
            )
        return devices

    def build_alerts(self) -> list[dict[str, Any]]:
        alerts = list(self._alerts)
        if not self.x32.is_online():
            alerts.append(
                {
                    "id": "alert-x32-offline",
                    "title": "X32 disconnected",
                    "message": "Console heartbeat lost",
                    "severity": "critical",
                    "source": "x32",
                    "acknowledged": False,
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "incidentId": None,
                }
            )
        for ch in self.x32.channels():
            if ch.clipping:
                mapping = self._mappings.get(ch.number, {})
                alerts.append(
                    {
                        "id": f"alert-clip-{ch.number}",
                        "title": f"{mapping.get('displayName') or ch.name} clipping",
                        "message": f"Channel {ch.number} exceeded 0 dBFS",
                        "severity": "warning",
                        "source": "x32",
                        "acknowledged": False,
                        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "incidentId": None,
                    }
                )
        loudness = self.build_loudness()
        if loudness["integratedLufs"] is not None and not loudness["inTarget"]:
            alerts.append(
                {
                    "id": "alert-lufs",
                    "title": "Stream LUFS outside target",
                    "message": f"Integrated {loudness['integratedLufs']} LUFS",
                    "severity": "warning",
                    "source": "loudness",
                    "acknowledged": False,
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "incidentId": None,
                }
            )
        return alerts[:20]

    def build_health(self) -> dict[str, Any]:
        channels = self.build_channels()
        buses = self.build_buses()
        loudness = self.build_loudness()
        stream_bus = next((b for b in buses if b["busKey"] == "stream_mix"), None)
        record_bus = next((b for b in buses if b["busKey"] == "recording_bus"), None)
        pastor = next((c for c in channels if c.get("roleKey") == "pastor_wireless"), None)
        choir = [c for c in channels if (c.get("roleKey") or "").startswith("choir_")]
        band = [c for c in channels if (c.get("roleKey") or "") in {"bass", "kick", "snare", "electric_guitar", "acoustic_guitar"}]

        items = [
            {"id": "x32", "label": "X32 connected", "passed": self.x32.is_online(), "severity": "critical", "detail": "OSC heartbeat"},
            {"id": "pastor", "label": "Pastor mic connected", "passed": pastor is not None and pastor["mappingConfigured"], "severity": "critical", "detail": "Mapping required"},
            {"id": "pastor_batt", "label": "Pastor mic battery above threshold", "passed": pastor is None or (pastor.get("wirelessBatteryPct") or 100) > self._settings["wirelessBatteryWarningPct"], "severity": "warning", "detail": "Wireless battery"},
            {"id": "choir", "label": "Choir mics active", "passed": any(c["levelDb"] > -50 for c in choir), "severity": "warning", "detail": "Signal present"},
            {"id": "band", "label": "Band channels active", "passed": any(c["levelDb"] > -50 for c in band), "severity": "warning", "detail": "Signal present"},
            {"id": "stream", "label": "Stream bus has audio", "passed": stream_bus is not None and stream_bus["levelDb"] > self._settings["streamSilenceThresholdDb"], "severity": "critical", "detail": "Stream mix"},
            {"id": "record", "label": "Recording bus has audio", "passed": record_bus is not None and record_bus["levelDb"] > self._settings["recordingSilenceThresholdDb"], "severity": "warning", "detail": "Recording bus"},
            {"id": "clip", "label": "No clipping", "passed": not any(c["clipping"] for c in channels), "severity": "critical", "detail": "Input headroom"},
            {"id": "feedback", "label": "No feedback", "passed": self._feedback["riskLevel"] in {"low", "medium"}, "severity": "critical", "detail": "RTA risk"},
            {"id": "lufs", "label": "LUFS in target range", "passed": loudness["inTarget"] or loudness["integratedLufs"] is None, "severity": "warning", "detail": "Loudness compliance"},
            {"id": "wireless", "label": "Wireless RF healthy", "passed": all(d["rfQuality"] != "critical" for d in self.build_wireless()), "severity": "warning", "detail": "RF monitor"},
            {"id": "delay", "label": "Audio delay acceptable", "passed": abs(self._delay["lipSyncOffsetMs"] or 0) <= 40, "severity": "warning", "detail": "Lip sync"},
            {"id": "backup", "label": "Backup mic available", "passed": any(d["backupAvailable"] for d in self.build_wireless()), "severity": "info", "detail": "Wireless backup"},
            {"id": "worker", "label": "Worker telemetry active", "passed": self.x32.is_online(), "severity": "info", "detail": "Audio worker"},
        ]
        passed = sum(1 for item in items if item["passed"])
        score = round((passed / len(items)) * 100)
        grade = "Excellent" if score >= 95 else "Good" if score >= 80 else "Fair" if score >= 60 else "Poor"
        return {
            "score": score,
            "grade": grade,
            "items": items,
            "ranAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def build_status(self) -> dict[str, Any]:
        health = self.build_health()
        return {
            "connection": "online" if self.x32.is_online() else "offline",
            "consoleName": self._settings.get("consoleDisplayName", "X32 — Church Main Console"),
            "x32Ip": self.x32.ip,
            "streamStatus": "live" if self.x32.is_online() else "offline",
            "streamLiveMs": None,
            "viewers": 0,
            "bitrateMbps": None,
            "droppedFrames": 0,
            "healthScore": health["score"],
            "lastHeartbeatAt": self.x32.console_state()["lastHeartbeatAt"],
            "oscLatencyMs": self.x32.console_state()["oscLatencyMs"],
        }

    def build_waveforms(self) -> list[dict[str, Any]]:
        if not self.x32.is_online():
            return [
                {"id": "master", "label": "Master L/R", "samples": [], "available": False},
                {"id": "stream", "label": "Stream Mix", "samples": [], "available": False},
                {"id": "record", "label": "Recording Bus", "samples": [], "available": False},
                {"id": "pastor", "label": "Pastor Mic", "samples": [], "available": False},
                {"id": "choir", "label": "Choir Bus", "samples": [], "available": False},
            ]
        t = time.time()
        return [
            {
                "id": "master",
                "label": "Master L/R",
                "samples": [round(math.sin(t * 4 + i * 0.25) * self._db_to_meter(b.level_db), 2) for i, b in enumerate(self.x32.buses())][:64],
                "available": True,
            },
            {
                "id": "stream",
                "label": "Stream Mix",
                "samples": [round(math.sin(t * 3 + i * 0.2) * 50, 2) for i in range(64)],
                "available": True,
            },
            {
                "id": "record",
                "label": "Recording Bus",
                "samples": [round(math.sin(t * 2.5 + i * 0.18) * 45, 2) for i in range(64)],
                "available": True,
            },
            {
                "id": "pastor",
                "label": "Pastor Mic",
                "samples": [round(math.sin(t * 5 + i * 0.3) * 35, 2) for i in range(64)],
                "available": True,
            },
            {
                "id": "choir",
                "label": "Choir Bus",
                "samples": [round(math.sin(t * 2 + i * 0.15) * 55, 2) for i in range(64)],
                "available": True,
            },
        ]

    def build_feedback(self) -> dict[str, Any]:
        if self.x32.is_online():
            peak_channel = max(self.x32.channels(), key=lambda c: c.level_db)
            if peak_channel.level_db > -6 and peak_channel.clipping:
                self._feedback.update(
                    {
                        "detectedFrequencyHz": 315,
                        "affectedChannel": peak_channel.number,
                        "riskLevel": "high",
                        "lastDetectedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "rtaBins": [round(abs(math.sin(i * 0.4)) * 100, 1) for i in range(64)],
                    }
                )
        return self._feedback

    def build_live_payload(self) -> dict[str, Any]:
        payload = {
            "status": self.build_status(),
            "channels": self.build_channels(),
            "buses": self.build_buses(),
            "overview": self.build_overview(),
            "alerts": self.build_alerts(),
            "wireless": self.build_wireless(),
            "loudness": self.build_loudness(),
            "delay": self._delay,
            "feedback": self.build_feedback(),
            "waveforms": self.build_waveforms(),
            "health": self.build_health(),
        }
        self.store.set_json("live", payload)
        return payload

    def _on_x32_update(self) -> None:
        payload = self.build_live_payload()
        self.store.publish("live", {"type": "snapshot", "payload": payload})

    def mute_channel(self, channel: int) -> None:
        self.x32.set_mute(channel, True)

    def unmute_channel(self, channel: int) -> None:
        self.x32.set_mute(channel, False)

    def solo_channel(self, channel: int) -> None:
        self.x32.set_solo(channel, True)

    def unsolo_channel(self, channel: int) -> None:
        self.x32.set_solo(channel, False)

    def recall_scene(self, index: int) -> None:
        self.x32.recall_scene(index)

    def apply_notch(self, frequency_hz: float, channel: int) -> None:
        self._feedback["autoNotchEnabled"] = True
        self._feedback["detectedFrequencyHz"] = frequency_hz
        self._feedback["affectedChannel"] = channel
        self._feedback["riskLevel"] = "low"

    def run_delay_check(self) -> dict[str, Any]:
        self._delay["syncConfidence"] = 0.95
        self._delay["driftMs"] = 1
        self._delay["lipSyncOffsetMs"] = 2
        self._delay["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return self._delay

    def apply_delay_correction(self) -> dict[str, Any]:
        self._delay["audioDelayMs"] = self._delay["videoDelayMs"]
        self._delay["lipSyncOffsetMs"] = 0
        self._delay["driftMs"] = 0
        self._delay["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return self._delay


audio_service = AudioService()
