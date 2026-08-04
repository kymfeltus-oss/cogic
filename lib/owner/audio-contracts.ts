/** Owner audio workspace contracts — presentational UI only; processing lives on media services. */

export type ConcertEqPreset = "spoken_word" | "full_choir" | "acoustic_prayer";

export type OwnerAudioConfig = {
  aiGainGuardEnabled: boolean;
  whiteNoiseSuppressor: number;
  concertEqPreset: ConcertEqPreset;
  masterLimiterCompressor: number;
};

export type AudioLevelTrack = {
  id: string;
  label: string;
  /** Current level in dBFS (-60 … 0). */
  levelDb: number;
  /** Peak hold in dBFS (-60 … 0). */
  peakDb: number;
};

export type OwnerAudioTelemetry = {
  tracks: AudioLevelTrack[];
  capturedAt: string;
  mediaNodeStatus: "online" | "offline" | "degraded";
  mediaNodeDetail: string | null;
};

export type OwnerAudioConfigPatch = Partial<OwnerAudioConfig>;

export type OwnerAudioWorkspaceState = {
  config: OwnerAudioConfig;
  telemetry: OwnerAudioTelemetry;
};

export const CONCERT_EQ_PRESET_LABELS: Record<ConcertEqPreset, string> = {
  spoken_word: "Spoken Word",
  full_choir: "Full Choir",
  acoustic_prayer: "Acoustic Prayer",
};

export const DEFAULT_OWNER_AUDIO_CONFIG: OwnerAudioConfig = {
  aiGainGuardEnabled: false,
  whiteNoiseSuppressor: 35,
  concertEqPreset: "full_choir",
  masterLimiterCompressor: 72,
};

export const DEFAULT_AUDIO_LEVEL_TRACKS: AudioLevelTrack[] = [
  { id: "program-l", label: "Program L", levelDb: -24, peakDb: -12 },
  { id: "program-r", label: "Program R", levelDb: -23, peakDb: -11 },
  { id: "choir-bus", label: "Choir Bus", levelDb: -18, peakDb: -6 },
  { id: "spoken", label: "Spoken Word", levelDb: -32, peakDb: -20 },
  { id: "stream-master", label: "Stream Master", levelDb: -14, peakDb: -4 },
];
