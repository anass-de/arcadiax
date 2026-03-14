"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

type SubmitButtonProps = {
  idleText?: string;
  pendingText?: string;
  className?: string;
};

export default function SubmitButton({
  idleText = "Änderungen speichern",
  pendingText = "Speichert...",
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={[
        "inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition",
        "hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:ring-offset-2 focus:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}

      <span>{pending ? pendingText : idleText}</span>
    </button>
  );
}