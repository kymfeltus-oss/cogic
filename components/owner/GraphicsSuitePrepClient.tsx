"use client";

import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BadgeIcon,
  BookOpen,
  Film,
  HeartHandshake,
  Loader2,
  Lock,
  MonitorPlay,
  Move,
  Pencil,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Square,
  Ticket,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  decodeGraphicsPresetMetadata,
  defaultGraphicsMetadataForKind,
  formatGraphicsTypeLabel,
  getGraphicsTypeHelp,
  GRAPHICS_PRESET_TYPES,
  OWNER_GRAPHICS_DEFAULT_THEME,
  type GraphicLayoutMode,
  type GraphicPositionAnchor,
  type GraphicsBuilderKind,
  type GraphicsPlacementAnchor,
  type GraphicsPresetType,
  type OwnerGraphicsPreset,
  type OwnerGraphicsTheme,
} from "@/lib/owner/graphics-data-plane";
import {
  BroadcastLowerThirdPreset,
  BroadcastPresentationSlate,
} from "@/components/owner/BroadcastGraphicPresets";

const BUILDER_KINDS = [...GRAPHICS_PRESET_TYPES, "SANCTUARY_VIDEO"] as const;

const TYPE_ICONS: Record<GraphicsBuilderKind, typeof BadgeIcon> = {
  LOWER_THIRD: BadgeIcon,
  OFFERING: HeartHandshake,
  SCRIPTURE: BookOpen,
  SLATE: Square,
  TICKER: Ticket,
  SANCTUARY_VIDEO: Film,
};

const LAYOUT_OPTIONS: Array<{ value: GraphicLayoutMode; label: string }> = [
  { value: "lower_third", label: "Lower Third" },
  { value: "fullscreen", label: "Full Screen" },
  { value: "partial", label: "Partial" },
  { value: "ticker", label: "Ticker" },
  { value: "corner_bug", label: "Corner Bug" },
  { value: "sanctuary_video", label: "Sanctuary Video" },
];

const POSITION_OPTIONS: Array<{ value: GraphicPositionAnchor; label: string }> = [
  { value: "FULLSCREEN", label: "Full Screen" },
  { value: "BOTTOM_LEFT", label: "Bottom Left" },
  { value: "BOTTOM_RIGHT", label: "Bottom Right" },
  { value: "TOP_LEFT", label: "Top Left" },
  { value: "TOP_RIGHT", label: "Top Right" },
  { value: "CENTER", label: "Center" },
];

const UPLOAD_SLOTS = [
  {
    key: "logo",
    label: "Logo",
    description: "Main event or ministry mark",
    accept: "image/png,image/jpeg,image/webp,image/svg+xml",
    target: "image",
  },
  {
    key: "offering-logo",
    label: "Offering Logo",
    description: "Giving, seed, QR, or offering art",
    accept: "image/png,image/jpeg,image/webp,image/svg+xml",
    target: "image",
  },
  {
    key: "custom-graphic",
    label: "Other Graphic",
    description: "Any full-screen or supporting image",
    accept: "image/png,image/jpeg,image/webp,image/svg+xml",
    target: "image",
  },
  {
    key: "sanctuary-video",
    label: "Video",
    description: "MP4, WEBM, or MOV for full-screen stream playback",
    accept: "video/mp4,video/webm,video/quicktime",
    target: "video",
  },
] as const;

type DurationMode = "manual" | "15" | "30" | "custom";

type ApiPresetResponse = {
  success: boolean;
  presets?: OwnerGraphicsPreset[];
  preset?: OwnerGraphicsPreset;
  deletedId?: string;
  error?: string;
};

type ApiThemeResponse = {
  success: boolean;
  theme?: OwnerGraphicsTheme | null;
  error?: string;
};

type ApiAssetResponse = {
  success: boolean;
  asset?: {
    label: string;
    url: string;
  };
  error?: string;
};

type UploadedSlotAssets = Partial<Record<(typeof UPLOAD_SLOTS)[number]["key"], { label: string; url: string }>>;

const DEFAULT_FORM = {
  primary: "COGIC LIVE",
  secondary: "HOLY CONVOCATION",
  customDuration: 45,
};

function compactId(id: string, index: number) {
  return `#${String(index + 1).padStart(3, "0")} / ${id.slice(0, 8)}`;
}

function getDurationSeconds(mode: DurationMode, customDuration: number) {
  if (mode === "15") return 15;
  if (mode === "30") return 30;
  if (mode === "custom") return Math.max(1, Math.min(3600, Math.trunc(customDuration || 1)));
  return 0;
}

function builderLabel(kind: GraphicsBuilderKind) {
  return kind === "SANCTUARY_VIDEO" ? "Sanctuary Video" : formatGraphicsTypeLabel(kind as GraphicsPresetType);
}

function getBuilderHelp(kind: GraphicsBuilderKind) {
  if (kind === "SANCTUARY_VIDEO") {
    return {
      primary: "Video Title",
      secondary: "Production Notes",
      placeholderPrimary: "SANCTUARY SCREEN ROLL-IN",
      placeholderSecondary: "Mirror the house-screen video to stream",
    };
  }

  return getGraphicsTypeHelp(kind);
}

function previewAccent(kind: GraphicsBuilderKind) {
  if (kind === "SANCTUARY_VIDEO") return "from-cyan-300 via-blue-400 to-emerald-300";
  if (kind === "OFFERING") return "from-lime-300 via-emerald-400 to-cyan-300";
  if (kind === "SCRIPTURE") return "from-amber-300 via-yellow-400 to-orange-400";
  if (kind === "SLATE") return "from-violet-300 via-purple-500 to-fuchsia-400";
  if (kind === "TICKER") return "from-yellow-300 via-orange-400 to-rose-400";
  return "from-[#0984ff] via-[#6c49ff] to-[#ff3fae]";
}

function sortPresets(presets: OwnerGraphicsPreset[]) {
  return [...presets].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

function defaultTheme(): OwnerGraphicsTheme {
  return {
    id: "default-theme",
    event_id: OWNER_GRAPHICS_DEFAULT_THEME.event_id,
    corner_radius_px: OWNER_GRAPHICS_DEFAULT_THEME.corner_radius_px,
    padding_px: OWNER_GRAPHICS_DEFAULT_THEME.padding_px,
    background_opacity_percent: OWNER_GRAPHICS_DEFAULT_THEME.background_opacity_percent,
    placement_anchor: OWNER_GRAPHICS_DEFAULT_THEME.placement_anchor,
    custom_logo_url: OWNER_GRAPHICS_DEFAULT_THEME.custom_logo_url,
    updated_at: new Date(0).toISOString(),
  };
}

function placementStyle(
  layoutMode: GraphicLayoutMode,
  positionAnchor: GraphicPositionAnchor,
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number,
): CSSProperties {
  if (positionAnchor === "FULLSCREEN" || layoutMode === "fullscreen" || layoutMode === "sanctuary_video") {
    return { inset: 0, width: "100%", height: "100%" };
  }

  if (layoutMode === "ticker") {
    return { left: "4%", right: "4%", bottom: "6%", minHeight: "9%" };
  }

  if (positionAnchor === "CENTER") {
    return {
      left: "50%",
      top: "50%",
      width: `${widthPercent}%`,
      minHeight: `${heightPercent}%`,
      transform: "translate(-50%, -50%)",
    };
  }

  return {
    left: `${xPercent}%`,
    top: `${yPercent}%`,
    width: `${widthPercent}%`,
    minHeight: `${heightPercent}%`,
  };
}

export default function GraphicsSuitePrepClient() {
  const [selectedKind, setSelectedKind] = useState<GraphicsBuilderKind>("LOWER_THIRD");
  const [primary, setPrimary] = useState(DEFAULT_FORM.primary);
  const [secondary, setSecondary] = useState(DEFAULT_FORM.secondary);
  const [durationMode, setDurationMode] = useState<DurationMode>("manual");
  const [customDuration, setCustomDuration] = useState(DEFAULT_FORM.customDuration);
  const [layoutMode, setLayoutMode] = useState<GraphicLayoutMode>("lower_third");
  const [positionAnchor, setPositionAnchor] = useState<GraphicPositionAnchor>("BOTTOM_LEFT");
  const [xPercent, setXPercent] = useState(6);
  const [yPercent, setYPercent] = useState(72);
  const [widthPercent, setWidthPercent] = useState(54);
  const [heightPercent, setHeightPercent] = useState(20);
  const [zIndex, setZIndex] = useState(10);
  const [mediaUrl, setMediaUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedSlotAssets, setUploadedSlotAssets] = useState<UploadedSlotAssets>({});
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [presets, setPresets] = useState<OwnerGraphicsPreset[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [theme, setTheme] = useState<OwnerGraphicsTheme>(() => defaultTheme());
  const [themeDraft, setThemeDraft] = useState({
    cornerRadiusPx: OWNER_GRAPHICS_DEFAULT_THEME.corner_radius_px,
    paddingPx: OWNER_GRAPHICS_DEFAULT_THEME.padding_px,
    backgroundOpacityPercent: OWNER_GRAPHICS_DEFAULT_THEME.background_opacity_percent,
    placementAnchor: OWNER_GRAPHICS_DEFAULT_THEME.placement_anchor as GraphicsPlacementAnchor,
    customLogoUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const previewSurfaceRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const selectedHelp = useMemo(() => getBuilderHelp(selectedKind), [selectedKind]);
  const activeDurationSeconds = getDurationSeconds(durationMode, customDuration);
  const previewBoxStyle = placementStyle(layoutMode, positionAnchor, xPercent, yPercent, widthPercent, heightPercent);
  const isMediaBuilder = selectedKind === "SANCTUARY_VIDEO" || layoutMode === "sanctuary_video";

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [presetsResponse, themeResponse] = await Promise.all([
        fetch("/api/owner/graphics/presets", { cache: "no-store" }),
        fetch("/api/owner/graphics/theme", { cache: "no-store" }),
      ]);

      const presetsJson = (await presetsResponse.json()) as ApiPresetResponse;
      const themeJson = (await themeResponse.json()) as ApiThemeResponse;

      if (!presetsResponse.ok || !presetsJson.success) {
        throw new Error(presetsJson.error || "Unable to load saved graphics presets.");
      }

      if (!themeResponse.ok || !themeJson.success) {
        throw new Error(themeJson.error || "Unable to load system theme defaults.");
      }

      const nextTheme = themeJson.theme ?? defaultTheme();
      setPresets(sortPresets(presetsJson.presets ?? []));
      setTheme(nextTheme);
      setThemeDraft({
        cornerRadiusPx: nextTheme.corner_radius_px,
        paddingPx: nextTheme.padding_px,
        backgroundOpacityPercent: nextTheme.background_opacity_percent,
        placementAnchor: nextTheme.placement_anchor,
        customLogoUrl: nextTheme.custom_logo_url ?? "",
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Graphics workspace failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  function applyMetadataDefaults(kind: GraphicsBuilderKind) {
    const metadata = defaultGraphicsMetadataForKind(kind);
    setLayoutMode(metadata.layoutMode);
    setPositionAnchor(metadata.positionAnchor);
    setXPercent(metadata.xPercent);
    setYPercent(metadata.yPercent);
    setWidthPercent(metadata.widthPercent);
    setHeightPercent(metadata.heightPercent);
    setZIndex(metadata.zIndex);
    setMediaUrl("");
    setImageUrl("");
  }

  function handleTypeSelect(kind: GraphicsBuilderKind) {
    const nextHelp = getBuilderHelp(kind);
    setSelectedKind(kind);
    setPrimary(nextHelp.placeholderPrimary);
    setSecondary(nextHelp.placeholderSecondary);
    applyMetadataDefaults(kind);
    setEditingPresetId(null);
    setSuccess(null);
    setError(null);
  }

  function handleEditPreset(preset: OwnerGraphicsPreset) {
    const metadata = decodeGraphicsPresetMetadata(preset);
    const help = getBuilderHelp(metadata.builderKind);
    setEditingPresetId(preset.id);
    setSelectedKind(metadata.builderKind);
    setPrimary(preset.content_primary || help.placeholderPrimary);
    setSecondary(metadata.secondaryText || "");
    setLayoutMode(metadata.layoutMode);
    setPositionAnchor(metadata.positionAnchor);
    setXPercent(metadata.xPercent);
    setYPercent(metadata.yPercent);
    setWidthPercent(metadata.widthPercent);
    setHeightPercent(metadata.heightPercent);
    setZIndex(metadata.zIndex);
    setMediaUrl(metadata.mediaUrl ?? "");
    setImageUrl(metadata.imageUrl ?? "");
    setDurationMode(preset.duration_seconds > 0 ? "custom" : "manual");
    setCustomDuration(preset.duration_seconds > 0 ? preset.duration_seconds : DEFAULT_FORM.customDuration);
    setSuccess(`${preset.content_primary} loaded for editing.`);
    setError(null);
  }

  function handleCancelEdit() {
    setEditingPresetId(null);
    handleTypeSelect("LOWER_THIRD");
    setSuccess(null);
    setError(null);
  }

  function handlePreviewDragStart(event: PointerEvent<HTMLDivElement>) {
    if (!previewSurfaceRef.current) return;
    const surfaceRect = previewSurfaceRef.current.getBoundingClientRect();
    const targetRect = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: ((event.clientX - targetRect.left) / surfaceRect.width) * 100,
      y: ((event.clientY - targetRect.top) / surfaceRect.height) * 100,
    };

    if (positionAnchor === "FULLSCREEN") setPositionAnchor("TOP_LEFT");
    if (layoutMode === "fullscreen" || layoutMode === "sanctuary_video") setLayoutMode("partial");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePreviewDragMove(event: PointerEvent<HTMLDivElement>) {
    if (!previewSurfaceRef.current || !dragOffsetRef.current) return;
    const surfaceRect = previewSurfaceRef.current.getBoundingClientRect();
    const nextX = ((event.clientX - surfaceRect.left) / surfaceRect.width) * 100 - dragOffsetRef.current.x;
    const nextY = ((event.clientY - surfaceRect.top) / surfaceRect.height) * 100 - dragOffsetRef.current.y;
    setXPercent(Math.max(0, Math.min(95, Math.round(nextX))));
    setYPercent(Math.max(0, Math.min(95, Math.round(nextY))));
  }

  function handlePreviewDragEnd(event: PointerEvent<HTMLDivElement>) {
    dragOffsetRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleUploadAsset(slot: string, file: File | null) {
    if (!file) return;
    setUploadingSlot(slot);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("slot", slot);
      formData.append("file", file);

      const response = await fetch("/api/owner/graphics/assets", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json()) as ApiAssetResponse;

      if (!response.ok || !json.success || !json.asset) {
        throw new Error(json.error || "Unable to upload graphic asset.");
      }

      const uploaded = {
        label: `${slot.replace(/-/g, " ")} upload`,
        url: json.asset.url,
      };
      const slotConfig = UPLOAD_SLOTS.find((item) => item.key === slot);
      if (slotConfig?.target === "video") {
        setUploadedSlotAssets((current) => ({ ...current, [slot]: uploaded }));
        setSelectedKind("SANCTUARY_VIDEO");
        setLayoutMode("sanctuary_video");
        setPositionAnchor("FULLSCREEN");
        setXPercent(0);
        setYPercent(0);
        setWidthPercent(100);
        setHeightPercent(100);
        setMediaUrl(uploaded.url);
        setSuccess(`${uploaded.label} uploaded and selected as the full-screen video.`);
      } else {
        setUploadedSlotAssets((current) => ({ ...current, [slot]: uploaded }));
        setImageUrl(uploaded.url);
        setSuccess(`${uploaded.label} uploaded and selected.`);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload graphic asset.");
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleSavePreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/owner/graphics/presets", {
        method: editingPresetId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPresetId,
          type: selectedKind,
          contentPrimary: primary,
          contentSecondary: secondary,
          durationSeconds: activeDurationSeconds,
          layoutMode,
          positionAnchor,
          xPercent,
          yPercent,
          widthPercent,
          heightPercent,
          zIndex,
          mediaUrl,
          imageUrl,
        }),
      });

      const json = (await response.json()) as ApiPresetResponse;
      if (!response.ok || !json.success || !json.preset) {
        throw new Error(json.error || "Unable to save graphic.");
      }

      setPresets((current) =>
        editingPresetId
          ? sortPresets(current.map((preset) => (preset.id === json.preset?.id ? (json.preset as OwnerGraphicsPreset) : preset)))
          : sortPresets([json.preset as OwnerGraphicsPreset, ...current]),
      );
      setEditingPresetId(json.preset.id);
      setSuccess(`${builderLabel(selectedKind)} ${editingPresetId ? "updated" : "saved"} in the Production Cockpit.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save graphic.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePreset(preset: OwnerGraphicsPreset) {
    const confirmed = window.confirm(`Delete "${preset.content_primary}" from the master graphics catalog?`);
    if (!confirmed) return;

    setDeletingPresetId(preset.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/owner/graphics/presets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preset.id }),
      });
      const json = (await response.json()) as ApiPresetResponse;
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Unable to delete graphic.");
      }

      setPresets((current) => current.filter((item) => item.id !== preset.id));
      if (editingPresetId === preset.id) handleCancelEdit();
      setSuccess(`${preset.content_primary} deleted from the master catalog.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete graphic.");
    } finally {
      setDeletingPresetId(null);
    }
  }

  async function handleSaveTheme(reset = false) {
    setThemeSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const body = reset
        ? {
            cornerRadiusPx: OWNER_GRAPHICS_DEFAULT_THEME.corner_radius_px,
            paddingPx: OWNER_GRAPHICS_DEFAULT_THEME.padding_px,
            backgroundOpacityPercent: OWNER_GRAPHICS_DEFAULT_THEME.background_opacity_percent,
            placementAnchor: OWNER_GRAPHICS_DEFAULT_THEME.placement_anchor,
            customLogoUrl: "",
          }
        : themeDraft;

      const response = await fetch("/api/owner/graphics/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as ApiThemeResponse;
      if (!response.ok || !json.success || !json.theme) {
        throw new Error(json.error || "Unable to save system theme defaults.");
      }

      setTheme(json.theme);
      setThemeDraft({
        cornerRadiusPx: json.theme.corner_radius_px,
        paddingPx: json.theme.padding_px,
        backgroundOpacityPercent: json.theme.background_opacity_percent,
        placementAnchor: json.theme.placement_anchor,
        customLogoUrl: json.theme.custom_logo_url ?? "",
      });
      setSuccess(reset ? "System theme defaults reset." : "System theme defaults updated.");
    } catch (themeError) {
      setError(themeError instanceof Error ? themeError.message : "Unable to save theme defaults.");
    } finally {
      setThemeSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-4 shadow-[0_0_28px_rgba(0,168,255,0.08)] sm:p-5">
        <div className="mb-5 text-center">
          <p className="font-ui text-[0.65rem] uppercase tracking-[0.28em] text-[#7aa7ff]">
            Create / Style / Save / Build your master catalog
          </p>
          <h2 className="mt-1 font-headline text-2xl uppercase tracking-[0.08em] text-white">
            Graphics Suite <span className="text-[#6d6dff]">Build & Prepare</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[6px] border border-white/10 bg-white/[0.03] text-white/70">
            <Loader2 className="mr-3 h-5 w-5 animate-spin text-[#00DDEB]" />
            Loading synchronized graphics workspace...
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[0.94fr_1.06fr]">
            <form onSubmit={handleSavePreset} className="space-y-4">
              <div className="rounded-[6px] border border-white/10 bg-black/30 p-4">
                <p className="mb-3 font-ui text-xs uppercase tracking-[0.16em] text-white/80">
                  1. Choose Graphic Type
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                  {BUILDER_KINDS.map((kind) => {
                    const Icon = TYPE_ICONS[kind];
                    const isSelected = selectedKind === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => handleTypeSelect(kind)}
                        className={`rounded-[6px] border p-3 text-center transition ${
                          isSelected
                            ? "border-[#1687ff] bg-[#073a85]/60 shadow-[0_0_18px_rgba(0,132,255,0.35)]"
                            : "border-white/10 bg-white/[0.03] hover:border-[#1687ff]/50"
                        }`}
                      >
                        <Icon className={`mx-auto mb-2 h-6 w-6 ${isSelected ? "text-[#18a0ff]" : "text-white/65"}`} />
                        <span className="font-ui text-[0.62rem] uppercase tracking-[0.08em] text-white">
                          {builderLabel(kind)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[6px] border border-white/10 bg-black/30 p-4">
                <p className="mb-3 font-ui text-xs uppercase tracking-[0.16em] text-white/80">
                  2. Content
                </p>
                <label className="block">
                  <span className="flex items-center justify-between font-ui text-[0.68rem] uppercase text-white/65">
                    {selectedHelp.primary}
                    <span>{primary.length}/180</span>
                  </span>
                  <input
                    value={primary}
                    onChange={(event) => setPrimary(event.target.value)}
                    placeholder={selectedHelp.placeholderPrimary}
                    maxLength={180}
                    className="mt-2 min-h-11 w-full rounded-[6px] border border-white/10 bg-[#07101f] px-3 font-ui text-sm text-white outline-none focus:border-[#1687ff]"
                    required
                  />
                </label>
                <label className="mt-3 block">
                  <span className="flex items-center justify-between font-ui text-[0.68rem] uppercase text-white/65">
                    {selectedHelp.secondary}
                    <span>{secondary.length}/260</span>
                  </span>
                  <textarea
                    value={secondary}
                    onChange={(event) => setSecondary(event.target.value)}
                    placeholder={selectedHelp.placeholderSecondary}
                    maxLength={260}
                    rows={3}
                    className="mt-2 w-full rounded-[6px] border border-white/10 bg-[#07101f] px-3 py-2 font-ui text-sm text-white outline-none focus:border-[#1687ff]"
                  />
                </label>
                {isMediaBuilder ? (
                  <label className="mt-3 block">
                    <span className="font-ui text-[0.68rem] uppercase text-white/65">
                      Video URL or local public path
                    </span>
                    <input
                      value={mediaUrl}
                      onChange={(event) => setMediaUrl(event.target.value)}
                      placeholder="/videos/sanctuary-roll-in.mp4 or https://..."
                      className="mt-2 min-h-11 w-full rounded-[6px] border border-white/10 bg-[#07101f] px-3 font-ui text-sm text-white outline-none focus:border-[#1687ff]"
                    />
                  </label>
                ) : null}
              </div>

              <div className="rounded-[6px] border border-white/10 bg-black/30 p-4">
                <p className="mb-3 font-ui text-xs uppercase tracking-[0.16em] text-white/80">
                  3. Upload / Choose Image
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {UPLOAD_SLOTS.map((slot) => {
                    const uploadedAsset = uploadedSlotAssets[slot.key];
                    const isVideoSlot = slot.target === "video";
                    const isSelected = uploadedAsset
                      ? isVideoSlot
                        ? mediaUrl === uploadedAsset.url
                        : imageUrl === uploadedAsset.url
                      : false;
                    return (
                      <label
                        key={slot.key}
                        className={`group flex min-h-36 cursor-pointer flex-col justify-between rounded-[6px] border p-3 transition ${
                          isSelected
                            ? "border-[#00DDEB] bg-[#00DDEB]/12 shadow-[0_0_16px_rgba(0,221,235,0.22)]"
                            : "border-dashed border-white/18 bg-[#07101f] hover:border-[#00DDEB]/60 hover:bg-[#00DDEB]/8"
                        }`}
                      >
                        <input
                          type="file"
                          accept={slot.accept}
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            void handleUploadAsset(slot.key, file);
                            event.currentTarget.value = "";
                          }}
                        />
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-ui text-xs uppercase tracking-[0.12em] text-white">
                            {slot.label}
                          </span>
                          {uploadingSlot === slot.key ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#00DDEB]" />
                          ) : (
                            <Upload className="h-4 w-4 text-[#00DDEB]" />
                          )}
                        </span>
                        <span className="mt-3 flex h-16 items-center justify-center overflow-hidden rounded bg-black/40 p-2">
                          {uploadedAsset ? (
                            isVideoSlot ? (
                              <video src={uploadedAsset.url} muted playsInline className="h-full w-full object-cover" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={uploadedAsset.url} alt="" className="max-h-full max-w-full object-contain" />
                            )
                          ) : (
                            <span className="font-ui text-[0.58rem] uppercase tracking-[0.14em] text-white/35">
                              Upload
                            </span>
                          )}
                        </span>
                        <span className="mt-3 font-body text-xs leading-snug text-white/50">
                          {uploadedAsset ? uploadedAsset.url : slot.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <label className="mt-3 block">
                  <span className="font-ui text-[0.68rem] uppercase text-white/65">
                    Custom image path or URL
                  </span>
                  <input
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    placeholder="/branding/awakening-lockup.png or https://..."
                    className="mt-2 min-h-11 w-full rounded-[6px] border border-white/10 bg-[#07101f] px-3 font-ui text-sm text-white outline-none focus:border-[#1687ff]"
                  />
                </label>
              </div>

              <div className="rounded-[6px] border border-white/10 bg-black/30 p-4">
                <p className="mb-3 inline-flex items-center gap-2 font-ui text-xs uppercase tracking-[0.16em] text-white/80">
                  <Move className="h-4 w-4 text-[#00DDEB]" />
                  4. Position & Size
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {LAYOUT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLayoutMode(option.value)}
                      className={`min-h-10 rounded-[6px] border font-ui text-[0.62rem] uppercase tracking-[0.08em] ${
                        layoutMode === option.value
                          ? "border-[#00DDEB] bg-[#00DDEB]/15 text-[#9df8ff]"
                          : "border-white/10 bg-white/[0.03] text-white/65"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="mt-3 block">
                  <span className="font-ui text-[0.68rem] uppercase text-white/65">Anchor</span>
                  <select
                    value={positionAnchor}
                    onChange={(event) => setPositionAnchor(event.target.value as GraphicPositionAnchor)}
                    className="mt-2 min-h-11 w-full rounded-[6px] border border-white/10 bg-[#07101f] px-3 font-ui text-sm text-white outline-none focus:border-[#1687ff]"
                  >
                    {POSITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    ["X", xPercent, setXPercent, 0, 95],
                    ["Y", yPercent, setYPercent, 0, 95],
                    ["Width", widthPercent, setWidthPercent, 5, 100],
                    ["Height", heightPercent, setHeightPercent, 5, 100],
                    ["Layer", zIndex, setZIndex, 0, 99],
                  ].map(([label, value, setter, min, max]) => (
                    <label key={label as string} className="block">
                      <span className="flex justify-between font-ui text-[0.68rem] uppercase text-white/65">
                        {label as string}
                        <span>
                          {value as number}
                          {label === "Layer" ? "" : "%"}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={min as number}
                        max={max as number}
                        value={value as number}
                        onChange={(event) => (setter as (next: number) => void)(Number.parseInt(event.target.value, 10))}
                        className="mt-2 w-full accent-[#00DDEB]"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-[6px] border border-white/10 bg-black/30 p-4">
                <p className="mb-3 font-ui text-xs uppercase tracking-[0.16em] text-white/80">
                  5. Duration Timer
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["manual", "Manual"],
                    ["15", "15s"],
                    ["30", "30s"],
                    ["custom", "Custom"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDurationMode(value as DurationMode)}
                      className={`min-h-10 rounded-[6px] border font-ui text-xs uppercase tracking-[0.12em] ${
                        durationMode === value
                          ? "border-[#00DDEB] bg-[#00DDEB]/15 text-[#9df8ff]"
                          : "border-white/10 bg-white/[0.03] text-white/65"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {durationMode === "custom" ? (
                  <label className="mt-3 block">
                    <span className="font-ui text-[0.68rem] uppercase text-white/65">
                      Custom seconds
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      value={customDuration}
                      onChange={(event) => setCustomDuration(Number.parseInt(event.target.value, 10) || 1)}
                      className="mt-2 min-h-11 w-full rounded-[6px] border border-white/10 bg-[#07101f] px-3 font-ui text-sm text-white outline-none focus:border-[#1687ff]"
                    />
                  </label>
                ) : null}
              </div>

              <details className="rounded-[6px] border border-white/10 bg-black/30 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-ui text-xs uppercase tracking-[0.14em] text-white/80">
                  <span className="inline-flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-[#b682ff]" />
                    Edit System Theme Defaults
                  </span>
                  <Lock className="h-4 w-4 text-white/45" />
                </summary>
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <label className="block">
                    <span className="flex justify-between font-ui text-[0.68rem] uppercase text-white/65">
                      Background Opacity <span>{themeDraft.backgroundOpacityPercent}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={themeDraft.backgroundOpacityPercent}
                      onChange={(event) =>
                        setThemeDraft((current) => ({
                          ...current,
                          backgroundOpacityPercent: Number.parseInt(event.target.value, 10),
                        }))
                      }
                      className="mt-2 w-full accent-[#b682ff]"
                    />
                  </label>
                  <label className="block">
                    <span className="flex justify-between font-ui text-[0.68rem] uppercase text-white/65">
                      Padding <span>{themeDraft.paddingPx}px</span>
                    </span>
                    <input
                      type="range"
                      min={4}
                      max={64}
                      value={themeDraft.paddingPx}
                      onChange={(event) =>
                        setThemeDraft((current) => ({
                          ...current,
                          paddingPx: Number.parseInt(event.target.value, 10),
                        }))
                      }
                      className="mt-2 w-full accent-[#1687ff]"
                    />
                  </label>
                  <label className="block">
                    <span className="font-ui text-[0.68rem] uppercase text-white/65">
                      Placement Anchor
                    </span>
                    <select
                      value={themeDraft.placementAnchor}
                      onChange={(event) =>
                        setThemeDraft((current) => ({
                          ...current,
                          placementAnchor: event.target.value as GraphicsPlacementAnchor,
                        }))
                      }
                      className="mt-2 min-h-11 w-full rounded-[6px] border border-white/10 bg-[#07101f] px-3 font-ui text-sm text-white outline-none focus:border-[#1687ff]"
                    >
                      <option value="BOTTOM_LEFT">Bottom Left</option>
                      <option value="BOTTOM_RIGHT">Bottom Right</option>
                      <option value="TOP_LEFT">Top Left</option>
                      <option value="TOP_RIGHT">Top Right</option>
                      <option value="CENTER">Center</option>
                    </select>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveTheme(true)}
                      disabled={themeSaving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.04] font-ui text-xs uppercase tracking-[0.14em] text-white/70 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset Defaults
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveTheme()}
                      disabled={themeSaving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#28104d] font-ui text-xs uppercase tracking-[0.14em] text-[#ecdfff] disabled:opacity-50"
                    >
                      {themeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Theme
                    </button>
                  </div>
                </div>
              </details>

              <button
                type="submit"
                disabled={saving || !primary.trim() || (selectedKind === "SANCTUARY_VIDEO" && !mediaUrl.trim())}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#096bff] font-ui text-sm uppercase tracking-[0.14em] text-white shadow-[0_0_22px_rgba(9,107,255,0.35)] transition hover:bg-[#1687ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingPresetId ? "Update Graphic" : "Save Graphic"}
              </button>
              {editingPresetId ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.04] font-ui text-xs uppercase tracking-[0.14em] text-white/70"
                >
                  <X className="h-4 w-4" />
                  Cancel Edit
                </button>
              ) : null}
            </form>

            <div className="space-y-4">
              <div className="rounded-[6px] border border-white/10 bg-black/30 p-4">
                <p className="mb-3 font-ui text-xs uppercase tracking-[0.16em] text-white/80">
                  Preview <span className="text-white/45">(title-safe applied)</span>
                </p>
                {selectedKind === "LOWER_THIRD" && layoutMode === "lower_third" ? (
                  <BroadcastLowerThirdPreset
                    mainText={primary || selectedHelp.placeholderPrimary}
                    subtitleText={secondary || selectedHelp.placeholderSecondary}
                    logoUrl={imageUrl.trim() || null}
                    className="rounded-[6px] border border-[#315ebd]/70 shadow-inner"
                  />
                ) : selectedKind === "SLATE" || layoutMode === "fullscreen" ? (
                  <BroadcastPresentationSlate
                    headerText={primary || selectedHelp.placeholderPrimary}
                    bodyText={secondary || selectedHelp.placeholderSecondary}
                    logoUrl={imageUrl.trim() || null}
                    className="rounded-[6px] border border-[#315ebd]/70 shadow-inner"
                  />
                ) : (
                  <div className="aspect-video rounded-[6px] border border-[#315ebd]/70 bg-[radial-gradient(circle_at_18%_18%,rgba(0,115,255,0.42),transparent_34%),radial-gradient(circle_at_82%_82%,rgba(255,40,174,0.34),transparent_38%),linear-gradient(135deg,#061022,#110727)] p-[5%] shadow-inner">
                  <div ref={previewSurfaceRef} className="relative h-full w-full overflow-hidden rounded-[6px] bg-black/20">
                    {imageUrl.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl.trim()}
                        alt=""
                        className="absolute right-4 top-4 max-h-12 max-w-[28%] object-contain drop-shadow-[0_0_14px_rgba(0,168,255,0.45)]"
                      />
                    ) : (
                      <div className="absolute right-4 top-4 text-right font-headline text-lg font-black leading-none text-[#5ca8ff]">
                        COGIC
                        <span className="block font-ui text-[0.48rem] tracking-[0.16em] text-white">LIVE</span>
                      </div>
                    )}
                    <div
                      className="absolute cursor-move touch-none"
                      onPointerDown={handlePreviewDragStart}
                      onPointerMove={handlePreviewDragMove}
                      onPointerUp={handlePreviewDragEnd}
                      onPointerCancel={handlePreviewDragEnd}
                      style={{ ...previewBoxStyle, zIndex }}
                    >
                      {isMediaBuilder ? (
                        <div className="flex h-full min-h-20 w-full items-center justify-center overflow-hidden rounded-[6px] border border-cyan-300/35 bg-black">
                          {mediaUrl.trim() ? (
                            <video src={mediaUrl.trim()} muted loop playsInline controls className="h-full w-full object-cover" />
                          ) : (
                            <div className="text-center">
                              <Film className="mx-auto mb-2 h-8 w-8 text-cyan-200" />
                              <p className="font-ui text-xs uppercase tracking-[0.18em] text-white">Sanctuary Video</p>
                            </div>
                          )}
                        </div>
                      ) : layoutMode === "ticker" ? (
                        <div className="overflow-hidden rounded-full border border-white/15 bg-black/70 px-5 py-3">
                          <p className={`bg-gradient-to-r ${previewAccent(selectedKind)} bg-clip-text font-ui text-sm uppercase tracking-[0.18em] text-transparent`}>
                            {primary || selectedHelp.placeholderPrimary} / {secondary || selectedHelp.placeholderSecondary}
                          </p>
                        </div>
                      ) : (
                        <div
                          className="h-full border border-white/15 bg-black/70"
                          style={{
                            borderRadius: themeDraft.cornerRadiusPx,
                            padding: themeDraft.paddingPx,
                            backgroundColor: `rgba(0,0,0,${themeDraft.backgroundOpacityPercent / 100})`,
                          }}
                        >
                          <div className={`mb-3 h-1.5 w-40 max-w-full rounded-full bg-gradient-to-r ${previewAccent(selectedKind)}`} />
                          <h3 className="font-headline text-2xl uppercase tracking-[0.08em] text-white sm:text-3xl">
                            {primary || selectedHelp.placeholderPrimary}
                          </h3>
                          <p className="mt-1 font-ui text-sm uppercase tracking-[0.16em] text-[#ff4eb7]">
                            {secondary || selectedHelp.placeholderSecondary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )}
              </div>

              <div className="rounded-[6px] border border-white/10 bg-black/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-ui text-xs uppercase tracking-[0.16em] text-white/80">
                    Master Graphics Catalog
                  </p>
                  <span className="rounded-full border border-white/10 px-3 py-1 font-ui text-[0.62rem] uppercase text-white/50">
                    {presets.length} saved
                  </span>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {presets.length === 0 ? (
                    <div className="rounded-[6px] border border-dashed border-white/15 p-6 text-center font-body text-sm text-white/50">
                      No graphics saved yet. Build the first preset on the left.
                    </div>
                  ) : (
                    presets.map((preset, index) => {
                      const metadata = decodeGraphicsPresetMetadata(preset);
                      return (
                        <article
                          key={preset.id}
                          className={`grid gap-3 rounded-[6px] border bg-[#06101f] p-3 sm:grid-cols-[0.8fr_1fr_2fr_0.8fr_auto] ${
                            editingPresetId === preset.id
                              ? "border-[#00DDEB] shadow-[0_0_18px_rgba(0,221,235,0.2)]"
                              : "border-white/10"
                          }`}
                        >
                          <p className="font-ui text-[0.68rem] uppercase text-white/55">
                            {compactId(preset.id, index)}
                          </p>
                          <p className="font-ui text-[0.68rem] uppercase tracking-[0.1em] text-[#8eb6ff]">
                            {builderLabel(metadata.builderKind)}
                          </p>
                          <div>
                            <p className="font-ui text-xs uppercase text-white">{preset.content_primary}</p>
                            <p className="mt-1 truncate font-body text-xs text-white/50">
                              {metadata.mediaUrl || metadata.imageUrl || metadata.secondaryText || "No secondary copy"}
                            </p>
                          </div>
                          <p className="font-ui text-[0.68rem] uppercase text-white/45">
                            {metadata.layoutMode.replace("_", " ")}
                            <span className="block text-[#00DDEB]/80">
                              {preset.duration_seconds > 0 ? `${preset.duration_seconds}s` : "Manual"}
                            </span>
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:w-24">
                            <button
                              type="button"
                              onClick={() => handleEditPreset(preset)}
                              className="inline-flex min-h-9 items-center justify-center rounded-[6px] border border-[#00DDEB]/40 bg-[#00DDEB]/10 text-[#9df8ff] transition hover:bg-[#00DDEB]/20"
                              aria-label={`Edit ${preset.content_primary}`}
                              title="Edit positioning and content"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={deletingPresetId === preset.id}
                              onClick={() => void handleDeletePreset(preset)}
                              className="inline-flex min-h-9 items-center justify-center rounded-[6px] border border-red-300/40 bg-red-500/10 text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                              aria-label={`Delete ${preset.content_primary}`}
                              title="Delete graphic"
                            >
                              {deletingPresetId === preset.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {error ? (
          <div className="mt-4 rounded-[6px] border border-red-500/40 bg-red-500/10 p-3 font-body text-sm text-red-100">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-[6px] border border-emerald-400/40 bg-emerald-400/10 p-3 font-body text-sm text-emerald-100">
            {success}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-[6px] border border-white/10 bg-[#050814]/94 p-4 sm:grid-cols-3">
        {[
          ["Position controls", "Save X/Y placement, size, anchor, and layer for every graphic."],
          ["Sanctuary video", "Pre-build a video roll-in that can be displayed on stream from the Cockpit deck."],
          ["Duration timers", "Manual, 15s, 30s, and custom durations are saved with every preset."],
        ].map(([title, copy]) => (
          <div key={title} className="rounded-[6px] border border-white/10 bg-white/[0.03] p-4">
            <MonitorPlay className="mb-3 h-5 w-5 text-[#00DDEB]" />
            <p className="font-ui text-xs uppercase tracking-[0.14em] text-white">{title}</p>
            <p className="mt-2 font-body text-sm text-white/50">{copy}</p>
          </div>
        ))}
      </div>

      <p className="text-center font-ui text-[0.65rem] uppercase tracking-[0.18em] text-white/35">
        Theme synced: radius {theme.corner_radius_px}px / padding {theme.padding_px}px / opacity{" "}
        {theme.background_opacity_percent}% / {theme.placement_anchor.replace("_", " ")}
      </p>
    </section>
  );
}
