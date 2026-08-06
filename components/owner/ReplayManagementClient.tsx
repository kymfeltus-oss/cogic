"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Recording = {
  id: string;
  stream_title: string;
  description: string | null;
  restream_event_id: string;
  recording_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  broadcast_date: string | null;
  archive_id: string | null;
  publication_status: string;
  occurrence_id: string | null;
  updated_at: string;
  media_source_type?: string | null;
  upload_status?: string | null;
  storage_path?: string | null;
};

type Occurrence = {
  id: string;
  title: string;
  localDate: string;
  visibility: string;
  status: string;
  replayRecordingId: string | null;
};

type ArchiveOption = {
  id: string;
  title: string;
  year: number;
  slug: string;
};

const STATUS_FILTERS = [
  "all",
  "draft",
  "ready",
  "published",
  "unpublished",
  "archived",
  "failed",
] as const;

export default function ReplayManagementClient() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [archives, setArchives] = useState<ArchiveOption[]>([]);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    streamTitle: "",
    description: "",
    recordingUrl: "",
    thumbnailUrl: "",
    durationSeconds: "",
    broadcastDate: "",
    occurrenceId: "",
    archiveId: "",
    publicationStatus: "ready",
  });

  const [createMode, setCreateMode] = useState<"upload" | "link">("upload");
  const [createForm, setCreateForm] = useState({
    streamTitle: "",
    restreamEventId: "",
    occurrenceId: "",
    recordingUrl: "",
    description: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [replayRes, occRes, archiveRes] = await Promise.all([
        fetch("/api/owner/replays", { credentials: "include" }),
        fetch("/api/owner/occurrences", { credentials: "include" }),
        fetch("/api/owner/archives", { credentials: "include" }),
      ]);
      if (!replayRes.ok) throw new Error((await replayRes.json()).error || "Unable to load replays.");
      if (!occRes.ok) throw new Error((await occRes.json()).error || "Unable to load occurrences.");
      const replayJson = (await replayRes.json()) as { recordings: Recording[] };
      const occJson = (await occRes.json()) as { occurrences: Occurrence[] };
      setRecordings(replayJson.recordings ?? []);
      setOccurrences(occJson.occurrences ?? []);
      if (archiveRes.ok) {
        const archiveJson = (await archiveRes.json()) as {
          archives: Array<{ id: string; title: string; year: number; slug: string }>;
        };
        setArchives(archiveJson.archives ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load replay management.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void load();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [load]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? recordings
        : recordings.filter((row) => row.publication_status === filter),
    [filter, recordings],
  );

  const selected = recordings.find((row) => row.id === selectedId) ?? null;
  const [formRecordingId, setFormRecordingId] = useState<string | null>(null);

  if (selected && selected.id !== formRecordingId) {
    setFormRecordingId(selected.id);
    setForm({
      streamTitle: selected.stream_title ?? "",
      description: selected.description ?? "",
      recordingUrl: selected.recording_url ?? "",
      thumbnailUrl: selected.thumbnail_url ?? "",
      durationSeconds:
        selected.duration_seconds != null ? String(selected.duration_seconds) : "",
      broadcastDate: selected.broadcast_date
        ? selected.broadcast_date.slice(0, 16)
        : "",
      occurrenceId: selected.occurrence_id ?? "",
      archiveId: selected.archive_id ?? "",
      publicationStatus: selected.publication_status,
    });
  } else if (!selected && formRecordingId !== null) {
    setFormRecordingId(null);
  }

  async function saveSelected(nextStatus?: string) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/owner/replays/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamTitle: form.streamTitle,
          description: form.description,
          recordingUrl: form.recordingUrl || null,
          thumbnailUrl: form.thumbnailUrl || null,
          durationSeconds: form.durationSeconds
            ? Number(form.durationSeconds)
            : undefined,
          broadcastDate: form.broadcastDate || undefined,
          occurrenceId: form.occurrenceId || undefined,
          archiveId: form.archiveId || null,
          publicationStatus: nextStatus ?? form.publicationStatus,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update replay.");
      setSuccess("Replay saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update replay.");
    } finally {
      setSaving(false);
    }
  }

  async function createRecording(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(null);
    try {
      if (createMode === "upload") {
        if (!uploadFile) throw new Error("Choose a video file to upload.");
        const sessionRes = await fetch("/api/owner/media/upload-session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamTitle: createForm.streamTitle,
            occurrenceId: createForm.occurrenceId,
            description: createForm.description || null,
            mimeType: uploadFile.type,
            fileSize: uploadFile.size,
          }),
        });
        const session = (await sessionRes.json()) as {
          recordingId?: string;
          signedUrl?: string;
          token?: string;
          path?: string;
          error?: string;
        };
        if (!sessionRes.ok || !session.recordingId || !session.signedUrl) {
          throw new Error(session.error || "Unable to start upload session.");
        }

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", session.signedUrl as string);
          xhr.setRequestHeader("Content-Type", uploadFile.type || "video/mp4");
          xhr.upload.onprogress = (progressEvent) => {
            if (!progressEvent.lengthComputable) return;
            setUploadProgress(
              Math.round((progressEvent.loaded / progressEvent.total) * 100),
            );
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed (${xhr.status}).`));
          };
          xhr.onerror = () => reject(new Error("Upload failed."));
          xhr.send(uploadFile);
        });

        const completeRes = await fetch("/api/owner/media/upload-complete", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingId: session.recordingId }),
        });
        const complete = (await completeRes.json()) as { error?: string };
        if (!completeRes.ok) {
          await fetch("/api/owner/media/upload-complete", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordingId: session.recordingId, failed: true }),
          });
          throw new Error(complete.error || "Unable to finalize upload.");
        }

        setSuccess("Video uploaded and marked ready. Publish when metadata is complete.");
        setUploadFile(null);
        setUploadProgress(100);
        setSelectedId(session.recordingId);
        setCreateForm({
          streamTitle: "",
          restreamEventId: "",
          occurrenceId: "",
          recordingUrl: "",
          description: "",
        });
        await load();
        return;
      }

      const response = await fetch("/api/owner/replays", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamTitle: createForm.streamTitle,
          restreamEventId: createForm.restreamEventId,
          occurrenceId: createForm.occurrenceId,
          recordingUrl: createForm.recordingUrl || null,
          description: createForm.description || null,
        }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error || "Unable to create replay.");
      }
      setSuccess("Replay created and linked.");
      setCreateForm({
        streamTitle: "",
        restreamEventId: "",
        occurrenceId: "",
        recordingUrl: "",
        description: "",
      });
      setSelectedId(data.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create replay.");
      setUploadProgress(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-[#00a8ff]">
            Recordings
          </h2>
          <label className="sr-only" htmlFor="replay-status-filter">
            Filter by status
          </label>
          <select
            id="replay-status-filter"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as (typeof STATUS_FILTERS)[number])
            }
            className="rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-white/60" role="status">
            Loading recordings…
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-4 text-sm text-white/60" role="status">
            No recordings match this filter. Create one with a real occurrence and
            playback URL.
          </p>
        ) : (
          <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
            {filtered.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full rounded border px-3 py-2 text-left transition ${
                    selectedId === row.id
                      ? "border-[#00a8ff]/55 bg-[#00a8ff]/12"
                      : "border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-white">
                    {row.stream_title}
                  </span>
                  <span className="mt-1 block text-[0.65rem] uppercase tracking-[0.12em] text-white/50">
                    {row.publication_status}
                    {row.media_source_type ? ` · ${row.media_source_type}` : ""}
                    {row.upload_status ? ` · ${row.upload_status}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-3">
        {(error || success) && (
          <div
            role={error ? "alert" : "status"}
            className={`rounded border px-3 py-2 text-sm ${
              error
                ? "border-red-400/40 bg-red-950/40 text-red-100"
                : "border-emerald-400/40 bg-emerald-950/30 text-emerald-100"
            }`}
          >
            {error || success}
          </div>
        )}

        <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-4">
          <h2 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-[#ff2faf]">
            Add video
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreateMode("upload")}
              className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.1em] ${
                createMode === "upload"
                  ? "border-[#00a8ff]/55 bg-[#00a8ff]/12 text-white"
                  : "border-white/15 text-white/70"
              }`}
            >
              Upload video
            </button>
            <button
              type="button"
              onClick={() => setCreateMode("link")}
              className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.1em] ${
                createMode === "link"
                  ? "border-[#00a8ff]/55 bg-[#00a8ff]/12 text-white"
                  : "border-white/15 text-white/70"
              }`}
            >
              Import / link existing recording
            </button>
          </div>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={createRecording}>
            <label className="block text-xs text-white/70">
              Title
              <input
                required
                value={createForm.streamTitle}
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    streamTitle: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            {createMode === "link" ? (
              <label className="block text-xs text-white/70">
                Restream / source event ID
                <input
                  required
                  value={createForm.restreamEventId}
                  onChange={(e) =>
                    setCreateForm((current) => ({
                      ...current,
                      restreamEventId: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            ) : (
              <label className="block text-xs text-white/70">
                Video file (MP4 preferred)
                <input
                  required
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            )}
            <label className="block text-xs text-white/70 md:col-span-2">
              Occurrence
              <select
                required
                value={createForm.occurrenceId}
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    occurrenceId: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="">Select occurrence</option>
                {occurrences.map((occ) => (
                  <option key={occ.id} value={occ.id}>
                    {occ.localDate} — {occ.title} ({occ.visibility}/{occ.status})
                  </option>
                ))}
              </select>
            </label>
            {createMode === "link" ? (
              <label className="block text-xs text-white/70 md:col-span-2">
                Playback URL
                <input
                  value={createForm.recordingUrl}
                  onChange={(e) =>
                    setCreateForm((current) => ({
                      ...current,
                      recordingUrl: e.target.value,
                    }))
                  }
                  placeholder="https://"
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            ) : null}
            <label className="block text-xs text-white/70 md:col-span-2">
              Description
              <textarea
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                rows={2}
                className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            {uploadProgress != null ? (
              <p className="md:col-span-2 text-xs text-white/70" role="status">
                Upload progress: {uploadProgress}%
              </p>
            ) : null}
            <button
              type="submit"
              disabled={saving || occurrences.length === 0}
              className="md:col-span-2 inline-flex min-h-11 items-center justify-center rounded bg-[#096bff] px-4 font-ui text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {saving
                ? createMode === "upload"
                  ? "Uploading…"
                  : "Saving…"
                : createMode === "upload"
                  ? "Upload & prepare"
                  : "Create & link occurrence"}
            </button>
          </form>
          {occurrences.length === 0 ? (
            <p className="mt-2 text-xs text-white/50">
              No occurrences exist yet. Create schedule occurrences before ingesting
              replays.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-white/45">
            Uploads go directly to approved object storage. Unpublish never deletes the
            source file.
          </p>
        </section>

        <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-4">
          <h2 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-[#00a8ff]">
            Edit selected replay
          </h2>
          {!selected ? (
            <p className="mt-3 text-sm text-white/60">Select a recording to edit.</p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-xs text-white/70">
                Title
                <input
                  value={form.streamTitle}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, streamTitle: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/70">
                Status
                <select
                  value={form.publicationStatus}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      publicationStatus: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  {STATUS_FILTERS.filter((status) => status !== "all").map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-white/70 md:col-span-2">
                Description
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, description: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/70 md:col-span-2">
                Playback URL
                <input
                  value={form.recordingUrl}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, recordingUrl: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/70">
                Thumbnail URL
                <input
                  value={form.thumbnailUrl}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, thumbnailUrl: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/70">
                Duration (seconds)
                <input
                  value={form.durationSeconds}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      durationSeconds: e.target.value,
                    }))
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/70">
                Recorded date/time
                <input
                  type="datetime-local"
                  value={form.broadcastDate}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      broadcastDate: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/70">
                Archive
                <select
                  value={form.archiveId}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, archiveId: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="">None</option>
                  {archives.map((archive) => (
                    <option key={archive.id} value={archive.id}>
                      {archive.year} — {archive.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-white/70 md:col-span-2">
                Event occurrence
                <select
                  value={form.occurrenceId}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      occurrenceId: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="">Keep current / unset</option>
                  {occurrences.map((occ) => (
                    <option key={occ.id} value={occ.id}>
                      {occ.localDate} — {occ.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveSelected()}
                  className="inline-flex min-h-11 items-center justify-center rounded bg-[#096bff] px-4 font-ui text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveSelected("published")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-emerald-400/40 px-4 font-ui text-xs uppercase tracking-[0.12em] text-emerald-200 disabled:opacity-50"
                >
                  Publish
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveSelected("unpublished")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-amber-400/40 px-4 font-ui text-xs uppercase tracking-[0.12em] text-amber-100 disabled:opacity-50"
                >
                  Unpublish
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveSelected("archived")}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 font-ui text-xs uppercase tracking-[0.12em] text-white/80 disabled:opacity-50"
                >
                  Archive
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
