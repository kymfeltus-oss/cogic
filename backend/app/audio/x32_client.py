from __future__ import annotations

import asyncio
import json
import socket
import struct
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import ThreadingOSCUDPServer
from pythonosc.udp_client import SimpleUDPClient


def _fader_to_db(value: float) -> float:
    if value <= 0.0:
        return -90.0
    return (value * 40.0) - 90.0


def _meter_blob_to_level(blob: bytes) -> float:
    if not blob or len(blob) < 4:
        return -90.0
    count = struct.unpack(">i", blob[:4])[0]
    if count <= 0 or len(blob) < 8:
        return -90.0
    sample = struct.unpack(">f", blob[4:8])[0]
    return max(-90.0, min(10.0, sample))


@dataclass
class ChannelState:
    number: int
    name: str = ""
    fader: float = 0.0
    level_db: float = -90.0
    muted: bool = False
    solo: bool = False
    clipping: bool = False
    updated_at: float = field(default_factory=time.time)


@dataclass
class BusState:
    key: str
    label: str
    fader: float = 0.0
    level_db: float = -90.0
    muted: bool = False
    updated_at: float = field(default_factory=time.time)


class X32Client:
    """Bidirectional OSC client for Behringer X32."""

    def __init__(self, ip: str, port: int = 10023, listen_port: int = 10024):
        self.ip = ip
        self.port = port
        self.listen_port = listen_port
        self.client = SimpleUDPClient(ip, port)
        self._dispatcher = Dispatcher()
        self._server: ThreadingOSCUDPServer | None = None
        self._thread: threading.Thread | None = None
        self._connected = False
        self._last_heartbeat = 0.0
        self._latency_ms: float | None = None
        self._firmware: str | None = None
        self._current_scene: str | None = None
        self._current_scene_index: int | None = None
        self._channels: dict[int, ChannelState] = {
            i: ChannelState(number=i) for i in range(1, 33)
        }
        self._buses: dict[str, BusState] = {
            "lr_master": BusState(key="lr_master", label="Master L/R"),
            "stream_mix": BusState(key="stream_mix", label="Stream Mix"),
            "monitor_mix": BusState(key="monitor_mix", label="Monitor Mix"),
            "choir_bus": BusState(key="choir_bus", label="Choir Bus"),
            "band_bus": BusState(key="band_bus", label="Band Bus"),
            "pastor_mic": BusState(key="pastor_mic", label="Pastor Mic"),
            "audience_mics": BusState(key="audience_mics", label="Audience Mics"),
            "recording_bus": BusState(key="recording_bus", label="Recording Bus"),
        }
        self._on_update: Callable[[], None] | None = None
        self._register_handlers()

    def _register_handlers(self) -> None:
        self._dispatcher.set_default_handler(self._handle_default)

        for ch in range(1, 33):
            ch_str = f"{ch:02d}"
            self._dispatcher.map(f"/ch/{ch_str}/config/name", self._make_name_handler(ch))
            self._dispatcher.map(f"/ch/{ch_str}/mix/fader", self._make_fader_handler(ch))
            self._dispatcher.map(f"/ch/{ch_str}/mix/on", self._make_mute_handler(ch))
            self._dispatcher.map(f"/ch/{ch_str}/mix/solo", self._make_solo_handler(ch))
            self._dispatcher.map(f"/ch/{ch_str}/meter", self._make_meter_handler(ch))

        self._dispatcher.map("/lr/mix/fader", self._bus_fader_handler("lr_master"))
        self._dispatcher.map("/bus/01/mix/fader", self._bus_fader_handler("stream_mix"))
        self._dispatcher.map("/bus/02/mix/fader", self._bus_fader_handler("monitor_mix"))
        self._dispatcher.map("/bus/03/mix/fader", self._bus_fader_handler("choir_bus"))
        self._dispatcher.map("/bus/04/mix/fader", self._bus_fader_handler("band_bus"))
        self._dispatcher.map("/bus/05/mix/fader", self._bus_fader_handler("pastor_mic"))
        self._dispatcher.map("/bus/06/mix/fader", self._bus_fader_handler("audience_mics"))
        self._dispatcher.map("/bus/07/mix/fader", self._bus_fader_handler("recording_bus"))
        self._dispatcher.map("/scene/name", self._scene_name_handler)
        self._dispatcher.map("/-stat/sound/ctrl/chn/scene", self._scene_index_handler)
        self._dispatcher.map("/xinfo", self._xinfo_handler)

    def set_update_callback(self, callback: Callable[[], None]) -> None:
        self._on_update = callback

    def _notify(self) -> None:
        if self._on_update:
            self._on_update()

    def _handle_default(self, address: str, *args: Any) -> None:
        if address.endswith("/meter") and args:
            self._last_heartbeat = time.time()

    def _make_name_handler(self, channel: int):
        def handler(_address: str, name: str) -> None:
            self._channels[channel].name = str(name)
            self._channels[channel].updated_at = time.time()
            self._notify()

        return handler

    def _make_fader_handler(self, channel: int):
        def handler(_address: str, value: float) -> None:
            state = self._channels[channel]
            state.fader = float(value)
            state.level_db = _fader_to_db(float(value))
            state.updated_at = time.time()
            self._notify()

        return handler

    def _make_mute_handler(self, channel: int):
        def handler(_address: str, value: float) -> None:
            self._channels[channel].muted = float(value) == 0.0
            self._channels[channel].updated_at = time.time()
            self._notify()

        return handler

    def _make_solo_handler(self, channel: int):
        def handler(_address: str, value: float) -> None:
            self._channels[channel].solo = float(value) == 1.0
            self._channels[channel].updated_at = time.time()
            self._notify()

        return handler

    def _make_meter_handler(self, channel: int):
        def handler(_address: str, blob: bytes) -> None:
            state = self._channels[channel]
            state.level_db = _meter_blob_to_level(blob)
            state.clipping = state.level_db > -1.0
            state.updated_at = time.time()
            self._last_heartbeat = time.time()
            self._notify()

        return handler

    def _bus_fader_handler(self, key: str):
        def handler(_address: str, value: float) -> None:
            bus = self._buses[key]
            bus.fader = float(value)
            bus.level_db = _fader_to_db(float(value))
            bus.updated_at = time.time()
            self._notify()

        return handler

    def _scene_name_handler(self, _address: str, name: str) -> None:
        self._current_scene = str(name)
        self._notify()

    def _scene_index_handler(self, _address: str, index: float) -> None:
        self._current_scene_index = int(index)
        self._notify()

    def _xinfo_handler(self, _address: str, *args: Any) -> None:
        if args:
            self._firmware = str(args[0])
        self._last_heartbeat = time.time()
        self._notify()

    def _start_listener(self) -> None:
        if self._server:
            return
        self._server = ThreadingOSCUDPServer(("0.0.0.0", self.listen_port), self._dispatcher)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    def connect(self) -> bool:
        if not self.ip:
            return False
        self._start_listener()
        started = time.time()
        self.client.send_message("/info", [])
        self.client.send_message("/xinfo", [])
        for ch in range(1, 33):
            ch_str = f"{ch:02d}"
            self.client.send_message(f"/ch/{ch_str}/config/name", [])
            self.client.send_message(f"/ch/{ch_str}/mix/fader", [])
            self.client.send_message(f"/ch/{ch_str}/mix/on", [])
            self.client.send_message(f"/ch/{ch_str}/mix/solo", [])
            self.client.send_message(f"/ch/{ch_str}/meter", [])
        self.client.send_message("/lr/mix/fader", [])
        self.client.send_message("/-stat/sound/ctrl/chn/scene", [])
        self.client.send_message("/scene/name", [])
        deadline = time.time() + 3.0
        while time.time() < deadline:
            if self._last_heartbeat > started:
                self._connected = True
                self._latency_ms = round((self._last_heartbeat - started) * 1000, 1)
                return True
            time.sleep(0.05)
        self._connected = False
        return False

    def disconnect(self) -> None:
        self._connected = False
        if self._server:
            self._server.shutdown()
            self._server = None
        self._thread = None

    def is_online(self) -> bool:
        return self._connected and (time.time() - self._last_heartbeat) < 10.0

    def test_connection(self) -> tuple[bool, float | None, str]:
        if not self.ip:
            return False, None, "X32 IP not configured"
        ping_start = time.time()
        self.client.send_message("/info", [])
        deadline = ping_start + 2.0
        while time.time() < deadline:
            if self._last_heartbeat >= ping_start:
                latency = round((self._last_heartbeat - ping_start) * 1000, 1)
                return True, latency, "X32 responded"
            time.sleep(0.02)
        return False, None, "X32 did not respond within timeout"

    def refresh_state(self) -> None:
        self.connect()

    def set_mute(self, channel: int, muted: bool) -> None:
        ch_str = f"{channel:02d}"
        self.client.send_message(f"/ch/{ch_str}/mix/on", [0 if muted else 1])
        self._channels[channel].muted = muted
        self._channels[channel].updated_at = time.time()
        self._notify()

    def set_solo(self, channel: int, solo: bool) -> None:
        ch_str = f"{channel:02d}"
        self.client.send_message(f"/ch/{ch_str}/mix/solo", [1 if solo else 0])
        self._channels[channel].solo = solo
        self._channels[channel].updated_at = time.time()
        self._notify()

    def recall_scene(self, index: int) -> None:
        self.client.send_message("/-action/goscene", [float(index)])
        self._current_scene_index = index
        self._notify()

    def channels(self) -> list[ChannelState]:
        return list(self._channels.values())

    def buses(self) -> list[BusState]:
        return list(self._buses.values())

    def console_state(self) -> dict[str, Any]:
        return {
            "online": self.is_online(),
            "ip": self.ip,
            "firmwareVersion": self._firmware,
            "currentScene": self._current_scene,
            "currentSceneIndex": self._current_scene_index,
            "sampleRate": 48000,
            "syncSource": "internal",
            "routingSummary": "32 inputs · 16 buses · matrix active",
            "usbCardRouting": "Card 1 → Bus 1-8",
            "connectedDevices": ["X32 Core", "S16 Stage Box"],
            "meterActive": self.is_online(),
            "lastHeartbeatAt": (
                None if self._last_heartbeat == 0 else time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self._last_heartbeat))
            ),
            "oscLatencyMs": self._latency_ms,
        }

    def subscribe_meters(self) -> None:
        self.client.send_message("/batchsubscribe", ["meter", "/meters", 50])
