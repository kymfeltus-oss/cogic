export type ParsedVmixState = {
  version: string | null;
  streaming: boolean;
  recording: boolean;
  activeInput: number | null;
  previewInput: number | null;
  inputCount: number | null;
};

function readTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function readBoolTag(xml: string, tag: string): boolean {
  const value = readTag(xml, tag);
  return value?.toLowerCase() === "true";
}

function readNumberTag(xml: string, tag: string): number | null {
  const value = readTag(xml, tag);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Lightweight XML parse for vMix state endpoint (no external XML lib). */
export function parseVmixStateXml(xml: string): ParsedVmixState {
  const inputMatches = xml.match(/<input[\s>]/gi);
  return {
    version: readTag(xml, "version"),
    streaming: readBoolTag(xml, "streaming"),
    recording: readBoolTag(xml, "recording"),
    activeInput: readNumberTag(xml, "active"),
    previewInput: readNumberTag(xml, "preview"),
    inputCount: inputMatches?.length ?? null,
  };
}

export function isValidVmixStateXml(xml: string): boolean {
  const lower = xml.toLowerCase();
  return lower.includes("<vmix") || lower.includes("<version") || lower.includes("<inputs");
}
