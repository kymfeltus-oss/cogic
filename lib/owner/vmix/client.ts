import { isAllowedVmixFunction, resolveVmixApiBaseUrl } from "@/lib/owner/vmix/config";
import { isValidVmixStateXml, parseVmixStateXml } from "@/lib/owner/vmix/parse-vmix-state";

export type VmixConnectionStatus = "unconfigured" | "reachable" | "unreachable" | "error";

export type VmixSnapshot = {
  configured: boolean;
  connection: VmixConnectionStatus;
  version: string | null;
  streaming: boolean;
  recording: boolean;
  activeInput: number | null;
  previewInput: number | null;
  inputCount: number | null;
  message: string | null;
  fetchedAt: string;
};

const VMIX_FETCH_TIMEOUT_MS = 8_000;

export async function fetchVmixSnapshot(): Promise<VmixSnapshot> {
  const baseUrl = resolveVmixApiBaseUrl();
  const fetchedAt = new Date().toISOString();

  if (!baseUrl) {
    return {
      configured: false,
      connection: "unconfigured",
      version: null,
      streaming: false,
      recording: false,
      activeInput: null,
      previewInput: null,
      inputCount: null,
      message: "Set VMIX_API_BASE_URL (e.g. http://127.0.0.1:8088/api) on the machine that can reach vMix.",
      fetchedAt,
    };
  }

  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      signal: AbortSignal.timeout(VMIX_FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        configured: true,
        connection: "unreachable",
        version: null,
        streaming: false,
        recording: false,
        activeInput: null,
        previewInput: null,
        inputCount: null,
        message: `vMix API returned HTTP ${response.status}.`,
        fetchedAt,
      };
    }

    const xml = await response.text();
    if (!isValidVmixStateXml(xml)) {
      return {
        configured: true,
        connection: "error",
        version: null,
        streaming: false,
        recording: false,
        activeInput: null,
        previewInput: null,
        inputCount: null,
        message: "vMix response was not recognizable XML state.",
        fetchedAt,
      };
    }

    const parsed = parseVmixStateXml(xml);
    return {
      configured: true,
      connection: "reachable",
      version: parsed.version,
      streaming: parsed.streaming,
      recording: parsed.recording,
      activeInput: parsed.activeInput,
      previewInput: parsed.previewInput,
      inputCount: parsed.inputCount,
      message: parsed.streaming ? "vMix is streaming." : "vMix connected — not streaming yet.",
      fetchedAt,
    };
  } catch (error) {
    return {
      configured: true,
      connection: "unreachable",
      version: null,
      streaming: false,
      recording: false,
      activeInput: null,
      previewInput: null,
      inputCount: null,
      message:
        error instanceof Error
          ? `Cannot reach vMix at ${baseUrl}: ${error.message}`
          : "Cannot reach vMix API.",
      fetchedAt,
    };
  }
}

export async function callVmixFunction(
  functionName: string,
  query: Record<string, string> = {},
): Promise<{ ok: boolean; message: string }> {
  if (!isAllowedVmixFunction(functionName)) {
    return { ok: false, message: `Function "${functionName}" is not allowed.` };
  }

  const baseUrl = resolveVmixApiBaseUrl();
  if (!baseUrl) {
    return { ok: false, message: "VMIX_API_BASE_URL is not configured." };
  }

  const url = new URL(baseUrl);
  url.searchParams.set("Function", functionName);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(VMIX_FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, message: `vMix command failed (HTTP ${response.status}).` };
    }

    return { ok: true, message: `${functionName} sent to vMix.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "vMix command failed.",
    };
  }
}

export async function startVmixStreaming(): Promise<{ ok: boolean; message: string }> {
  return callVmixFunction("StartStreaming");
}

export async function stopVmixStreaming(): Promise<{ ok: boolean; message: string }> {
  const stopStream = await callVmixFunction("StopStreaming");
  if (!stopStream.ok) return stopStream;
  await callVmixFunction("StopRecording");
  return stopStream;
}
