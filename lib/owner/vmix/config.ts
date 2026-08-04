/** Server-only — vMix Web API base (no trailing Function path). */
export function resolveVmixApiBaseUrl(): string | null {
  const raw = process.env.VMIX_API_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function isVmixConfigured(): boolean {
  return Boolean(resolveVmixApiBaseUrl());
}

const ALLOWED_VMIX_FUNCTIONS = new Set([
  "StartStreaming",
  "StopStreaming",
  "StartRecording",
  "StopRecording",
  "Cut",
  "Fade",
]);

export function isAllowedVmixFunction(name: string): boolean {
  return ALLOWED_VMIX_FUNCTIONS.has(name);
}
