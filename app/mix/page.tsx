"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import SampleList, { Group } from "@/components/SampleList";
import DawMixer from "@/components/DawMixer";

type MeResp = { authenticated?: boolean; email?: string; plan?: "FREE" | "PRO" };

export default function MixPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [me, setMe] = useState<MeResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ authenticated: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/samples.manifest.json")
      .then((r) => r.json())
      .then((json) => setGroups(json.categories || []))
      .catch(() => setGroups([]));
  }, []);

  return (
    <main className="min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3 h-[78vh]">
          <SampleList groups={groups} />
        </aside>
        <section className="col-span-12 lg:col-span-9 space-y-6">
          {loading ? (
            <div className="glass rounded-2xl p-6 text-sm text-gray-400">Checking authentication…</div>
          ) : me?.authenticated ? (
            <DawMixer />
          ) : (
            <div className="glass rounded-2xl p-8">
              <h2 className="text-xl font-semibold mb-2">Please sign in to use the Mixer</h2>
              <p className="text-gray-400 mb-4">
                The DAW-style mixer is available for logged-in users. You can still explore the Library on the left.
              </p>
              <div className="flex gap-2">
                <a href="/login" className="btn-primary rounded-lg">Log in</a>
                <a href="/signup" className="btn-ghost rounded-lg">Create account</a>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
