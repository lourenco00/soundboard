"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default function SuccessPage() {
  return (
    <main className="min-h-screen">
      <TopBar />
      <Suspense fallback={<Centered>Finalizing your upgrade…</Centered>}>
        <SuccessInner />
      </Suspense>
    </main>
  );
}

function SuccessInner() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (!sessionId) {
      // No session id — assume the webhook will/has handled it.
      setState("done");
      return;
    }
    fetch("/api/entitlements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(r => (r.ok ? setState("done") : setState("error")))
      .catch(() => setState("error"));
  }, [sessionId]);

  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <div className="glass-strong rounded-3xl p-10 text-center relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative">
          {state === "loading" && (
            <>
              <div className="text-4xl mb-3">⏳</div>
              <h1 className="text-2xl font-bold">Activating your plan…</h1>
              <p className="text-gray-400 mt-2">One moment while we confirm your payment.</p>
            </>
          )}
          {state === "done" && (
            <>
              <div className="text-5xl mb-3">🎧</div>
              <h1 className="text-3xl font-bold">You're <span className="gradient-text">PRO</span>!</h1>
              <p className="text-gray-300 mt-2">
                Payment successful. Your full studio is unlocked — AI Forge, the DAW timeline, cloud presets, and more.
              </p>
              <div className="mt-6 flex justify-center gap-3 flex-wrap">
                <Link href="/" className="btn-primary rounded-xl px-6 py-3">Open the studio</Link>
                <Link href="/ai" className="btn-outline rounded-xl px-6 py-3">Try AI Forge</Link>
              </div>
            </>
          )}
          {state === "error" && (
            <>
              <div className="text-4xl mb-3">⚠️</div>
              <h1 className="text-2xl font-bold">Almost there</h1>
              <p className="text-gray-400 mt-2">
                Your payment went through, but we couldn't confirm it instantly. It'll update automatically within a minute — or refresh this page.
              </p>
              <div className="mt-6">
                <Link href="/" className="btn-outline rounded-xl px-6 py-3">Go to studio</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 py-20 text-center text-gray-400">{children}</div>;
}
