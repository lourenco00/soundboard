// components/TopBar.tsx
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; auth?: boolean };

const NAV: NavLink[] = [
  { href: "/",          label: "Studio" },
  { href: "/daw",       label: "DAW",       auth: true },
  { href: "/sequencer", label: "Sequencer", auth: true },
  { href: "/piano",     label: "Piano",     auth: true },
  { href: "/ai",        label: "AI Forge",  auth: true },
];

export default function TopBar() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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

  const initials = (email?.split("@")[0] || "").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-xl bg-black/40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 blur-md opacity-60 group-hover:opacity-100 transition" />
            <Image
              src="/soundboardlab.png"
              alt="Soundboard Lab"
              width={28}
              height={28}
              className="rounded-md relative"
            />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-white text-sm">Soundboard <span className="gradient-text">Lab</span></div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500">Make sound. Ship beats.</div>
          </div>
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(item => {
            const disabled = item.auth && !authed;
            const active = pathname === item.href;
            const cls = `relative px-3 py-1.5 rounded-lg text-sm transition ${
              active ? "text-white bg-white/10" : "text-gray-300 hover:text-white hover:bg-white/5"
            } ${disabled ? "opacity-50" : ""}`;
            return disabled ? (
              <Link key={item.href} href="/login" className={cls} title="Log in to use this">
                {item.label}
                <span className="ml-1 text-[9px] text-amber-300/80">●</span>
              </Link>
            ) : (
              <Link key={item.href} href={item.href} className={cls}>
                {item.label}
                {item.label === "AI Forge" && <span className="ml-1.5 pro-badge">New</span>}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {plan && (
            <span className={`hidden sm:inline-flex items-center text-[10px] px-2 py-1 rounded-md font-semibold ${
              plan === "PRO" ? "pro-badge" : "bg-white/10 text-gray-200"
            }`}>
              {plan === "PRO" ? "★ PRO" : plan}
            </span>
          )}
          {authed ? (
            <>
              <button
                className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 bg-white/5 hover:bg-white/10 transition"
                onClick={() => setOpen(o => !o)}
              >
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-[11px] font-bold text-white">
                  {initials || "U"}
                </span>
                <span className="hidden md:block text-xs text-gray-200 max-w-[140px] truncate">{email}</span>
              </button>
              {open && (
                <div
                  className="absolute right-4 top-14 glass-strong rounded-xl p-2 min-w-[200px] text-sm"
                  onMouseLeave={() => setOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-white/10">
                    <div className="text-xs text-gray-400">Signed in as</div>
                    <div className="font-medium text-gray-100 truncate">{email}</div>
                  </div>
                  <Link href="/" className="block px-3 py-2 rounded-md hover:bg-white/10 mt-1">Studio</Link>
                  <Link href="/ai" className="block px-3 py-2 rounded-md hover:bg-white/10">AI Forge</Link>
                  <button onClick={logout} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10 text-rose-300">
                    Log out
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary rounded-lg px-4 py-1.5 text-sm">
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
