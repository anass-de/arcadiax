"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Props = {
  releaseId: string;
  initialLikesCount: number;
  initialLikedByMe: boolean;
};

export default function ReleaseLikeButton({
  releaseId,
  initialLikesCount,
  initialLikedByMe,
}: Props) {
  const { status } = useSession();

  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [likedByMe, setLikedByMe] = useState(initialLikedByMe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLikesCount(initialLikesCount);
    setLikedByMe(initialLikedByMe);
  }, [initialLikesCount, initialLikedByMe]);

  async function toggleLike() {
    if (status !== "authenticated") {
      setError("Please login to like this release.");
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const res = await fetch(`/api/releases/${releaseId}/like`, {
        method: likedByMe ? "DELETE" : "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Like action failed");
      }

      setLikedByMe(data.likedByMe);
      setLikesCount(data.likesCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggleLike}
        disabled={busy}
        className={[
          "rounded-2xl px-5 py-3 font-medium transition",
          likedByMe
            ? "border border-pink-700 bg-pink-950/60 text-pink-200 hover:bg-pink-950"
            : "border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800",
          busy ? "opacity-60" : "",
        ].join(" ")}
      >
        {busy
          ? "..."
          : likedByMe
          ? `♥ Liked (${likesCount})`
          : `♡ Like (${likesCount})`}
      </button>

      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}