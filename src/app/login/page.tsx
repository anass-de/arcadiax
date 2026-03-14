"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    const res = await signIn("credentials", {
      redirect: false,
      email: identifier,
      password,
    });

    if (res?.error) {
      setError("Invalid login credentials.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] text-white">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] p-8 shadow-xl">

        <h1 className="mb-6 text-3xl font-bold">
          Welcome back to <span className="text-[#6c5ce7]">ArcadiaX</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="text"
            placeholder="Username or Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className="w-full rounded-lg bg-[#1f2937] p-3 outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg bg-[#1f2937] p-3 outline-none focus:ring-2 focus:ring-[#6c5ce7]"
          />

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#6c5ce7] py-3 font-semibold hover:opacity-90"
          >
            Sign In
          </button>
        </form>

      </div>
    </div>
  );
}