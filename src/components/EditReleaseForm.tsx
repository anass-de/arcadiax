"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Release = {
  id: string;
  title: string;
  version: string;
  description: string | null;
  fileUrl: string;
};

export default function EditReleaseForm({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    version: "",
    description: "",
    fileUrl: "",
  });

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/releases/${id}`);
        const data = (await res.json()) as Release | { error: string };
        if (!res.ok) {
          setError("Release nicht gefunden");
          return;
        }
        const r = data as Release;
        setForm({
          title: r.title,
          version: r.version,
          description: r.description ?? "",
          fileUrl: r.fileUrl,
        });
      } catch {
        setError("Netzwerkfehler");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/releases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          version: form.version,
          description: form.description || null,
          fileUrl: form.fileUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError((data as any)?.error ?? "Update fehlgeschlagen");
        return;
      }

      router.push("/releases");
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-600">Loading...</div>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Title</label>
        <input
          className="mt-1 w-full rounded-xl border p-3"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Version</label>
        <input
          className="mt-1 w-full rounded-xl border p-3"
          value={form.version}
          onChange={(e) => setForm({ ...form, version: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">File URL</label>
        <input
          className="mt-1 w-full rounded-xl border p-3"
          value={form.fileUrl}
          onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="mt-1 w-full rounded-xl border p-3"
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl border px-4 py-2 font-medium shadow-sm disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}