/**
 * Canonical `public.mixers` table definition.
 *
 * Source of truth order:
 * 1. supabase/migrations/*.sql  (apply first)
 * 2. This file                  (TypeScript row + column map)
 * 3. lib/todays-service/types.ts (API/domain Mixer type)
 * 4. lib/todays-service/repository.ts (read/write mapping)
 *
 * Never add a column to repository or API types before it exists here AND in a migration.
 */

export const MIXER_DB_TABLE = "mixers" as const;

/** snake_case column names exactly as stored in PostgreSQL */
export const MIXER_DB_COLUMNS = {
  id: "id",
  /** church_id in product terminology */
  tenantId: "tenant_id",
  serviceId: "service_id",
  soundItemId: "sound_item_id",
  name: "name",
  /** Legacy driver slug e.g. behringer_x32 */
  mixerModel: "mixer_model",
  /** Legacy network field — prefer ethernet_ip_address for new code */
  ipAddress: "ip_address",
  manufacturer: "manufacturer",
  model: "model",
  connectionType: "connection_type",
  ethernetIpAddress: "ethernet_ip_address",
  usbDeviceName: "usb_device_name",
  usbDeviceId: "usb_device_id",
  firmwareVersion: "firmware_version",
  serialNumber: "serial_number",
  connectionStatus: "connection_status",
  lastConnectionMethod: "last_connection_method",
  lastConnectedAt: "last_connected_at",
  importedSetupJson: "imported_setup_json",
  connectionConfigJson: "connection_config_json",
  createdAt: "created_at",
  updatedAt: "updated_at",
} as const;

export type MixerConnectionTypeDb = "ethernet" | "usb" | "both" | "manual" | "unknown";

export type MixerConnectionStatusDb =
  | "connected"
  | "detected"
  | "needs_attention"
  | "not_connected";

/** Row shape returned by Supabase for public.mixers */
export type MixerDbRow = {
  id: string;
  tenant_id: string;
  service_id: string;
  sound_item_id: string | null;
  name: string;
  mixer_model: string;
  ip_address: string;
  manufacturer: string | null;
  model: string | null;
  connection_type: MixerConnectionTypeDb;
  ethernet_ip_address: string | null;
  usb_device_name: string | null;
  usb_device_id: string | null;
  firmware_version: string | null;
  serial_number: string | null;
  connection_status: MixerConnectionStatusDb;
  last_connection_method: string | null;
  last_connected_at: string | null;
  imported_setup_json: Record<string, unknown> | null;
  connection_config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Required columns that must exist after 20260630120000_mixers_schema_sync.sql */
export const MIXER_REQUIRED_COLUMNS = [
  MIXER_DB_COLUMNS.id,
  MIXER_DB_COLUMNS.tenantId,
  MIXER_DB_COLUMNS.name,
  MIXER_DB_COLUMNS.manufacturer,
  MIXER_DB_COLUMNS.model,
  MIXER_DB_COLUMNS.connectionType,
  MIXER_DB_COLUMNS.ethernetIpAddress,
  MIXER_DB_COLUMNS.usbDeviceName,
  MIXER_DB_COLUMNS.usbDeviceId,
  MIXER_DB_COLUMNS.firmwareVersion,
  MIXER_DB_COLUMNS.serialNumber,
  MIXER_DB_COLUMNS.connectionStatus,
  MIXER_DB_COLUMNS.lastConnectionMethod,
  MIXER_DB_COLUMNS.lastConnectedAt,
  MIXER_DB_COLUMNS.importedSetupJson,
  MIXER_DB_COLUMNS.createdAt,
  MIXER_DB_COLUMNS.updatedAt,
] as const;
