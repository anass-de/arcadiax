"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

type SubmitButtonProps = {
  idleText?: string;
  pendingText?: string;
  className?: string;
};

export default function SubmitButton({
  idleText = "Save Changes",
  pendingText = "Saving...",
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={[
        "inline-flex items-center gap-2 rounded-2xl bg-[#6c5ce7] px-5 py-3 text-sm font-semibold text-white transition",
        "hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]/40 focus:ring-offset-2 focus:ring-offset-[#0b0f17]",
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