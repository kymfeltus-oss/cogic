"use client";

import { useCallback, useEffect, useState } from "react";

type Archive = {
  id: string;
  title: string;
  year: number;
  slug: string;
  convocationNumber: number;
  description: string | null;
  published: boolean;
  sortOrder: number;
};

type Collection = {
  id: string;
  archiveId: string;
  title: string;
  slug: string;
  key: string;
  description: string | null;
  published: boolean;
  sortOrder: number;
};

type RecordingOption = {
  id: string;
  stream_title: string;
  publication_status: string;
};

type Assignment = {
  collection_id: string;
  recording_id: string;
  sort_order: number;
};

export default function ArchiveManagementClient() {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [recordings, setRecordings] = useState<RecordingOption[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [archiveForm, setArchiveForm] = useState({
    title: "",
    year: String(new Date().getFullYear()),
    convocationNumber: "",
    slug: "",
    description: "",
    published: false,
  });

  const [collectionForm, setCollectionForm] = useState({
    title: "",
    slug: "",
    key: "",
    description: "",
    published: false,
  });

  const [assignRecordingId, setAssignRecordingId] = useState("");

  const loadArchives = useCallback(async () => {
    const response = await fetch("/api/owner/archives", { credentials: "include" });
    const data = (await response.json()) as { archives?: Archive[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load archives.");
    setArchives(data.archives ?? []);
  }, []);

  const loadCollections = useCallback(async (archiveId: string) => {
    const response = await fetch(
      `/api/owner/collections?archiveId=${encodeURIComponent(archiveId)}`,
      { credentials: "include" },
    );
    const data = (await response.json()) as {
      collections?: Collection[];
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || "Unable to load collections.");
    setCollections(data.collections ?? []);
  }, []);

  const loadAssignments = useCallback(async (collectionId: string) => {
    const response = await fetch(
      `/api/owner/collections/${collectionId}/recordings`,
      { credentials: "include" },
    );
    const data = (await response.json()) as {
      assignments?: Assignment[];
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || "Unable to load assignments.");
    setAssignments(data.assignments ?? []);
  }, []);

  const loadRecordings = useCallback(async () => {
    const response = await fetch("/api/owner/replays", { credentials: "include" });
    const data = (await response.json()) as {
      recordings?: RecordingOption[];
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || "Unable to load recordings.");
    setRecordings(data.recordings ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void (async () => {
        try {
          await Promise.all([loadArchives(), loadRecordings()]);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Unable to load archive tools.");
          }
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadArchives, loadRecordings]);

  useEffect(() => {
    if (!selectedArchiveId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void loadCollections(selectedArchiveId).catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load collections.");
        }
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadCollections, selectedArchiveId]);

  useEffect(() => {
    if (!selectedCollectionId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void loadAssignments(selectedCollectionId).catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load assignments.");
        }
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadAssignments, selectedCollectionId]);

  const visibleCollections = selectedArchiveId ? collections : [];
  const visibleAssignments = selectedCollectionId ? assignments : [];

  async function createArchive(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/owner/archives", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: archiveForm.title,
          year: Number(archiveForm.year),
          convocationNumber: Number(archiveForm.convocationNumber),
          slug: archiveForm.slug || undefined,
          description: archiveForm.description || null,
          published: archiveForm.published,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to create archive.");
      setSuccess("Archive created.");
      setArchiveForm({
        title: "",
        year: String(new Date().getFullYear()),
        convocationNumber: "",
        slug: "",
        description: "",
        published: false,
      });
      await loadArchives();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create archive.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchivePublished(archive: Archive) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/owner/archives/${archive.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !archive.published }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update archive.");
      setSuccess(archive.published ? "Archive unpublished." : "Archive published.");
      await loadArchives();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update archive.");
    } finally {
      setSaving(false);
    }
  }

  async function createCollection(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedArchiveId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/owner/collections", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archiveId: selectedArchiveId,
          title: collectionForm.title,
          slug: collectionForm.slug || undefined,
          key: collectionForm.key || undefined,
          description: collectionForm.description || null,
          published: collectionForm.published,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to create collection.");
      setSuccess("Collection created.");
      setCollectionForm({
        title: "",
        slug: "",
        key: "",
        description: "",
        published: false,
      });
      await loadCollections(selectedArchiveId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create collection.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCollectionPublished(collection: Collection) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/owner/collections/${collection.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !collection.published }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update collection.");
      setSuccess(
        collection.published ? "Collection unpublished." : "Collection published.",
      );
      if (selectedArchiveId) await loadCollections(selectedArchiveId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update collection.");
    } finally {
      setSaving(false);
    }
  }

  async function assignRecording(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedCollectionId || !assignRecordingId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/owner/collections/${selectedCollectionId}/recordings`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingId: assignRecordingId }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to assign recording.");
      setSuccess("Recording assigned to collection.");
      setAssignRecordingId("");
      await loadAssignments(selectedCollectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign recording.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(recordingId: string) {
    if (!selectedCollectionId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/owner/collections/${selectedCollectionId}/recordings?recordingId=${encodeURIComponent(recordingId)}`,
        { method: "DELETE", credentials: "include" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to remove assignment.");
      setSuccess("Assignment removed.");
      await loadAssignments(selectedCollectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
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
        <h2 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-[#00a8ff]">
          Create Convocation archive
        </h2>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={createArchive}>
          <label className="block text-xs text-white/70">
            Title
            <input
              required
              value={archiveForm.title}
              onChange={(e) =>
                setArchiveForm((current) => ({ ...current, title: e.target.value }))
              }
              placeholder="118th Holy Convocation — 2026"
              className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/70">
            Slug
            <input
              value={archiveForm.slug}
              onChange={(e) =>
                setArchiveForm((current) => ({ ...current, slug: e.target.value }))
              }
              placeholder="118th-2026"
              className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/70">
            Year
            <input
              required
              inputMode="numeric"
              value={archiveForm.year}
              onChange={(e) =>
                setArchiveForm((current) => ({ ...current, year: e.target.value }))
              }
              className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/70">
            Convocation number
            <input
              required
              inputMode="numeric"
              value={archiveForm.convocationNumber}
              onChange={(e) =>
                setArchiveForm((current) => ({
                  ...current,
                  convocationNumber: e.target.value,
                }))
              }
              placeholder="118"
              className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/70 md:col-span-2">
            Description
            <textarea
              value={archiveForm.description}
              onChange={(e) =>
                setArchiveForm((current) => ({
                  ...current,
                  description: e.target.value,
                }))
              }
              rows={2}
              className="mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={archiveForm.published}
              onChange={(e) =>
                setArchiveForm((current) => ({
                  ...current,
                  published: e.target.checked,
                }))
              }
            />
            Publish immediately
          </label>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center rounded bg-[#096bff] px-4 font-ui text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            Create archive
          </button>
        </form>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-3">
          <h3 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-white/70">
            Archives
          </h3>
          {archives.length === 0 ? (
            <p className="mt-3 text-sm text-white/55">No archives yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {archives.map((archive) => (
                <li key={archive.id} className="rounded border border-white/10 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedArchiveId(archive.id);
                      setSelectedCollectionId(null);
                      setAssignments([]);
                    }}
                    className={`w-full text-left text-sm ${
                      selectedArchiveId === archive.id ? "text-[#00a8ff]" : "text-white"
                    }`}
                  >
                    {archive.year} — {archive.title}
                  </button>
                  <p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-white/45">
                    {archive.published ? "published" : "unpublished"} · {archive.slug}
                  </p>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void toggleArchivePublished(archive)}
                    className="mt-2 text-xs text-brand-blue underline"
                  >
                    {archive.published ? "Unpublish" : "Publish"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-3">
          <h3 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-white/70">
            Collections
          </h3>
          {!selectedArchiveId ? (
            <p className="mt-3 text-sm text-white/55">Select an archive first.</p>
          ) : (
            <>
              <form className="mt-3 space-y-2" onSubmit={createCollection}>
                <input
                  required
                  value={collectionForm.title}
                  onChange={(e) =>
                    setCollectionForm((current) => ({
                      ...current,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Revival Fire"
                  className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
                <input
                  value={collectionForm.slug}
                  onChange={(e) =>
                    setCollectionForm((current) => ({
                      ...current,
                      slug: e.target.value,
                    }))
                  }
                  placeholder="revival-fire"
                  className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
                <label className="inline-flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={collectionForm.published}
                    onChange={(e) =>
                      setCollectionForm((current) => ({
                        ...current,
                        published: e.target.checked,
                      }))
                    }
                  />
                  Publish collection
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded bg-[#096bff] px-3 text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  Add collection
                </button>
              </form>
              <ul className="mt-3 space-y-2">
                {visibleCollections.map((collection) => (
                  <li key={collection.id} className="rounded border border-white/10 p-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCollectionId(collection.id)}
                      className={`w-full text-left text-sm ${
                        selectedCollectionId === collection.id
                          ? "text-[#00a8ff]"
                          : "text-white"
                      }`}
                    >
                      {collection.title}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void toggleCollectionPublished(collection)}
                      className="mt-2 text-xs text-brand-blue underline"
                    >
                      {collection.published ? "Unpublish" : "Publish"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-3">
          <h3 className="font-ui text-xs font-black uppercase tracking-[0.14em] text-white/70">
            Collection assignments
          </h3>
          {!selectedCollectionId ? (
            <p className="mt-3 text-sm text-white/55">Select a collection first.</p>
          ) : (
            <>
              <form className="mt-3 space-y-2" onSubmit={assignRecording}>
                <select
                  required
                  value={assignRecordingId}
                  onChange={(e) => setAssignRecordingId(e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select recording</option>
                  {recordings.map((recording) => (
                    <option key={recording.id} value={recording.id}>
                      {recording.stream_title} ({recording.publication_status})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded bg-[#096bff] px-3 text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  Assign recording
                </button>
              </form>
              <ul className="mt-3 space-y-2">
                {visibleAssignments.length === 0 ? (
                  <li className="text-sm text-white/55">No recordings assigned.</li>
                ) : (
                  visibleAssignments.map((assignment) => {
                    const recording = recordings.find(
                      (row) => row.id === assignment.recording_id,
                    );
                    return (
                      <li
                        key={`${assignment.collection_id}-${assignment.recording_id}`}
                        className="flex items-center justify-between gap-2 rounded border border-white/10 px-2 py-2 text-sm"
                      >
                        <span className="truncate">
                          {recording?.stream_title ?? assignment.recording_id}
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void removeAssignment(assignment.recording_id)}
                          className="text-xs text-red-200 underline"
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
