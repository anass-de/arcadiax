"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  title: string;
  version: string;
  description: string;
  fileUrl: string;
};

export default function NewReleaseForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    title: "",
    version: "",
    description: "",
    fileUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/releases", {
        method: "POST",
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
        setError(data?.error ?? "Unbekannter Fehler");
        setLoading(false);
        return;
      }

      // Erfolg: zurück zur Liste
      router.push("/releases");
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Title *</label>
        <input
          className="mt-1 w-full rounded-xl border p-3"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="ArcadiaX v0.3"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Version *</label>
        <input
          className="mt-1 w-full rounded-xl border p-3"
          value={form.version}
          onChange={(e) => setForm({ ...form, version: e.target.value })}
          placeholder="0.3.0"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">File URL *</label>
        <input
          className="mt-1 w-full rounded-xl border p-3"
          value={form.fileUrl}
          onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
          placeholder="https://example.com/arcadiax-0.3.0.zip"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Muss mit http:// oder https:// beginnen.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="mt-1 w-full rounded-xl border p-3"
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Was ist neu?"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl border px-4 py-2 font-medium shadow-sm disabled:opacity-60"
      >
        {loading ? "Speichern..." : "Release erstellen"}
      </button>
    </form>
  );
}