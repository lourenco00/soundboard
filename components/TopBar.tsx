"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { authenticated: boolean; email?: string; plan?: "FREE"|"PRO" };

export default function TopBar() {
  const [me,setMe]=useState<Me>({ authenticated:false });

  useEffect(()=>{ fetch("/api/me").then(r=>r.json()).then(setMe).catch(()=>{}); }, []);

  async function logout(){ await fetch("/api/auth/logout",{method:"POST"}); location.href="/"; }

  return (
    <div className="sticky top-0 z-20 backdrop-blur-md bg-black/30 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-indigo-600"></div>
          <span className="font-semibold">Pro Soundboard</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm px-3 py-1 rounded-full bg-white/10 border border-white/10">
            Plan: <b>{me.plan || "FREE"}</b>
          </span>
          {!me.authenticated ? (
            <>
              <Link href="/login" className="btn-ghost rounded-xl">Log in</Link>
              <Link href="/signup" className="btn-primary rounded-xl">Sign up</Link>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-300">{me.email}</span>
              <button onClick={logout} className="btn-ghost rounded-xl">Logout</button>
              {me.plan !== "PRO" && (
                <form action="/api/create-checkout" method="POST">
                  <button className="btn-primary rounded-xl">Upgrade to Pro</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}