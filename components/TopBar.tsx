// components/TopBar.tsx
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function TopBar() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => {
        setAuthed(!!d?.authenticated);
        setEmail(d?.email ?? null);
        setPlan(d?.plan ?? null);
      })
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.reload();
  }

  return (
    <header className="px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo + Name */}
        <div className="flex items-center gap-2 font-semibold text-white">
          <Image
            src="/soundboardlab.png"
            alt="Soundboard Lab Logo"
            width={28}
            height={28}
            className="rounded"
          />
          Soundboard Lab
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {plan && (
            <span className="text-xs px-2 py-1 rounded-md bg-white/10">
              Plan: {plan}
            </span>
          )}
          {authed ? (
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-80">{email}</span>
              <button
                className="btn-ghost rounded-md px-3 py-1"
                onClick={logout}
              >
                Log out
              </button>
            </div>
          ) : (
            <>
              <a href="/login" className="btn-ghost rounded-md px-3 py-1">
                Log in
              </a>
              <a href="/signup" className="btn-ghost rounded-md px-3 py-1">
                Sign up
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
