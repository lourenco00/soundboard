"use client";

import TopBar from "@/components/TopBar";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import the DAW page to avoid SSR issues
const DawPage = dynamic(() => import("../daw/page"), { ssr: false });

type MeResp = { authenticated?: boolean };

export default function MixPage() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ authenticated: false }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-7xl px-4 py-6">
        {loading ? (
          <div className="glass rounded-2xl p-6 text-sm text-gray-400">
            Checking authentication…
          </div>
        ) : me?.authenticated ? (
          <DawPage />
        ) : (
          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-2">
              Please sign in to use the Mixer
            </h2>
            <p className="text-gray-400 mb-4">
              The DAW-style mixer is available for logged-in users.
            </p>
            <div className="flex gap-2">
              <a href="/login" className="btn-primary rounded-lg">Log in</a>
              <a href="/signup" className="btn-ghost rounded-lg">Create account</a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
