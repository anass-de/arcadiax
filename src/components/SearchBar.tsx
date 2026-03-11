"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSearch} className="flex w-full">
      <input
        type="text"
        placeholder="Search releases..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-l-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
      />

      <button
        type="submit"
        className="rounded-r-2xl bg-white px-5 py-3 text-sm font-medium text-black hover:bg-zinc-200"
      >
        Search
      </button>
    </form>
  );
}