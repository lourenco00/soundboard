"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";

type KeyStatus = { configured: boolean; last4: string | null };
type KeysResponse = { anthropic: KeyStatus; openai: KeyStatus };

type Provider = "anthropic" | "openai";

const PROVIDER_META: Record<Provider, { label: string; placeholder: string; help: string }> = {
  anthropic: {
    label: "Claude (Anthropic)",
    placeholder: "sk-ant-...",
    help: "Used by the AI Forge to generate synthesis patches with Claude.",
  },
  openai: {
    label: "OpenAI",
    placeholder: "sk-...",
    help: "Used by the AI Forge to generate synthesis patches with GPT models.",
  },
};

export default function AccountPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [keys, setKeys] = useState<KeysResponse | null>(null);

  const [drafts, setDrafts] = useState<Record<Provider, string>>({ anthropic: "", openai: "" });
  const [busy, setBusy] = useState<Provider | null>(null);
  const [status, setStatus] = useState<Record<Provider, { ok?: string; err?: string }>>({
    anthropic: {},
    openai: {},
  });

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => {
        setAuthed(!!d?.authenticated);
        setEmail(d?.email ?? null);
        setPlan(d?.plan ?? null);
      })
      .catch(() => setAuthed(false));

    fetch("/api/account/keys")
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setKeys(d))
      .catch(() => {});
  }, []);

  async function saveKey(provider: Provider) {
    const apiKey = drafts[provider].trim();
    if (!apiKey) return;
    setBusy(provider);
    setStatus(s => ({ ...s, [provider]: {} }));
    try {
      const res = await fetch("/api/account/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(s => ({ ...s, [provider]: { err: data?.error || "Failed to save" } }));
        return;
      }
      setKeys(prev => ({
        anthropic: prev?.anthropic ?? { configured: false, last4: null },
        openai: prev?.openai ?? { configured: false, last4: null },
        [provider]: { configured: true, last4: data.last4 },
      }));
      setDrafts(d => ({ ...d, [provider]: "" }));
      setStatus(s => ({ ...s, [provider]: { ok: "Saved" } }));
    } catch {
      setStatus(s => ({ ...s, [provider]: { err: "Network error" } }));
    } finally {
      setBusy(null);
    }
  }

  async function removeKey(provider: Provider) {
    setBusy(provider);
    setStatus(s => ({ ...s, [provider]: {} }));
    try {
      const res = await fetch("/api/account/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(s => ({ ...s, [provider]: { err: data?.error || "Failed to remove" } }));
        return;
      }
      setKeys(prev => ({
        anthropic: prev?.anthropic ?? { configured: false, last4: null },
        openai: prev?.openai ?? { configured: false, last4: null },
        [provider]: { configured: false, last4: null },
      }));
      setStatus(s => ({ ...s, [provider]: { ok: "Removed" } }));
    } finally {
      setBusy(null);
    }
  }

  if (authed === false) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="glass rounded-2xl p-8">
            <div className="font-semibold mb-1">You&rsquo;re not logged in.</div>
            <p className="text-sm text-gray-400 mb-4">Sign in to manage your account and API keys.</p>
            <a href="/login" className="btn-primary rounded-lg px-4 py-2 text-sm inline-block">Log in</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-violet-300 mb-1">Account</div>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {/* Profile */}
        <section className="glass-strong rounded-2xl p-6 mb-6">
          <div className="font-semibold mb-4">Profile</div>
          <div className="grid grid-cols-2 gap-4 text-sm max-w-md">
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">Email</div>
              <div className="text-gray-100">{email || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">Plan</div>
              <div className="text-gray-100">
                {plan === "PRO" ? <span className="pro-badge px-2 py-0.5 rounded-md text-xs">★ PRO</span> : plan || "FREE"}
              </div>
            </div>
          </div>
        </section>

        {/* API keys */}
        <section className="glass-strong rounded-2xl p-6">
          <div className="font-semibold mb-1">AI Forge — API keys</div>
          <p className="text-sm text-gray-400 mb-5">
            Bring your own key so AI Forge generations run on your account. Keys are encrypted and never
            shown again in full. If you don&rsquo;t add one, the Forge falls back to the server&rsquo;s shared key (if
            configured) or an on-device fallback synth.
          </p>

          <div className="space-y-5">
            {(["anthropic", "openai"] as Provider[]).map(provider => {
              const meta = PROVIDER_META[provider];
              const k = keys?.[provider];
              const s = status[provider];
              return (
                <div key={provider} className="rounded-xl glass p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium text-sm">{meta.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{meta.help}</div>
                    </div>
                    {k?.configured && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20 shrink-0">
                        Connected · ····{k.last4}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2 flex-wrap">
                    <input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      className="flex-1 min-w-[220px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400/60"
                      placeholder={k?.configured ? "Replace key…" : meta.placeholder}
                      value={drafts[provider]}
                      onChange={e => setDrafts(d => ({ ...d, [provider]: e.target.value }))}
                    />
                    <button
                      onClick={() => saveKey(provider)}
                      disabled={busy === provider || !drafts[provider].trim()}
                      className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {busy === provider ? "Saving…" : "Save"}
                    </button>
                    {k?.configured && (
                      <button
                        onClick={() => removeKey(provider)}
                        disabled={busy === provider}
                        className="btn-ghost rounded-lg px-3 py-2 text-sm text-rose-300 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {s?.ok && <div className="mt-2 text-xs text-emerald-300">{s.ok}</div>}
                  {s?.err && <div className="mt-2 text-xs text-amber-300">{s.err}</div>}
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-xs text-gray-500 text-center mt-8">
          Keys are encrypted at rest and used only to call the respective provider on your behalf when you
          use the AI Forge.
        </p>
      </div>
    </main>
  );
}
