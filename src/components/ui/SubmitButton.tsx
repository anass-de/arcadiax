"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/12 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-400/40 hover:bg-blue-500/18 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
      ) : (
        <Save className="h-4 w-4 text-blue-300" />
      )}
      <span>{pending ? "Speichert..." : "Änderungen speichern"}</span>
    </button>
  );
}