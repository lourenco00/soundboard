"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function submit(e: any) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    if (!r.ok) return setErr(j.error || "Failed");
    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-6">
          <Image
            src="/soundboardlab.png"
            alt="Soundboard Lab"
            width={36}
            height={36}
            className="rounded-xl"
            priority
          />
          <span className="text-xl font-semibold tracking-wide">Soundboard Lab</span>
        </Link>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-xl font-semibold mb-1">Log in</h1>
          <p className="text-sm text-gray-400 mb-4">Welcome back. Let’s make some noise.</p>

          <form onSubmit={submit} className="space-y-3">
            <input
              className="w-full bg-white/10 rounded-md px-3 py-2"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="w-full bg-white/10 rounded-md px-3 py-2"
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <button className="btn-primary rounded-xl w-full">Log in</button>
          </form>

          <div className="text-sm text-gray-400 mt-3">
            No account?{" "}
            <Link href="/signup" className="underline">
              Create one
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
