"""Pydantic mirror of public.mixers — must match lib/database/mixers.ts and SQL migrations."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

MixerConnectionType = Literal["ethernet", "usb", "both", "manual", "unknown"]
MixerConnectionStatus = Literal["connected", "needs_attention", "not_connected", "development"]


class MixerRecord(BaseModel):
    """Row shape for public.mixers (tenant_id = church_id in product terms)."""

    id: UUID
    tenant_id: str = Field(description="Church/tenant identifier (church_id)")
    service_id: UUID
    sound_item_id: UUID | None = None
    name: str
    mixer_model: str = "behringer_x32"
    ip_address: str = ""
    manufacturer: str | None = None
    model: str | None = None
    connection_type: MixerConnectionType = "unknown"
    ethernet_ip_address: str | None = None
    usb_device_name: str | None = None
    usb_device_id: str | None = None
    firmware_version: str | None = None
    serial_number: str | None = None
    connection_status: MixerConnectionStatus = "not_connected"
    last_connection_method: str | None = None
    last_connected_at: datetime | None = None
    imported_setup_json: dict[str, Any] | None = None
    connection_config_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
