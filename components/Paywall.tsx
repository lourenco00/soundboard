"use client";
import { useState } from "react";

const TIERS = [
  {
    id: "studio",
    name: "Studio",
    price: 9,
    sub: "/mo",
    blurb: "For producers building real beats.",
    cta: "Upgrade to Studio",
    featured: true,
    features: [
      "AI Sample Forge · 200 gens/mo",
      "Full DAW timeline + WAV bounce",
      "Cloud presets & share links",
      "10-minute recording limit",
      "FX rack: reverb · delay · sidechain",
    ],
  },
  {
    id: "producer",
    name: "Producer",
    price: 24,
    sub: "/mo",
    blurb: "For pros shipping commercial work.",
    cta: "Upgrade to Producer",
    featured: false,
    features: [
      "Unlimited AI Sample Forge",
      "Stem separation & vocal isolation",
      "Collaborative sessions (4 seats)",
      "Priority rendering · 320kbps",
      "Commercial license included",
    ],
  },
];

export default function Paywall({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<"studio" | "producer">("studio");

  return (
    <div className="rounded-2xl overflow-hidden">
      <div className="text-center mb-6">
        <div className="text-xs uppercase tracking-widest text-violet-300 mb-2">Upgrade required</div>
        <h3 className="text-2xl md:text-3xl font-bold">{title}</h3>
        <p className="text-sm text-gray-400 mt-2 max-w-xl mx-auto">
          You're a few clicks from a real studio. Pick a tier — cancel anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TIERS.map(t => {
          const isSelected = selected === t.id;
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => setSelected(t.id as any)}
              className={`text-left rounded-2xl p-6 transition relative ${
                isSelected
                  ? "glass-strong gradient-border glow-violet"
                  : "glass hover:bg-white/[.07]"
              }`}
            >
              {t.featured && (
                <span className="absolute top-3 right-3 pro-badge">Most popular</span>
              )}
              <div className="text-sm uppercase tracking-widest text-gray-400">{t.name}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-bold">${t.price}</span>
                <span className="text-sm text-gray-400">{t.sub}</span>
              </div>
              <div className="text-sm text-gray-300 mt-1">{t.blurb}</div>
              <ul className="mt-4 space-y-1.5 text-sm text-gray-300">
                {t.features.map(f => (
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <form action="/api/create-checkout" method="POST" className="mt-5 flex flex-col sm:flex-row items-center gap-3 justify-center">
        <input type="hidden" name="tier" value={selected} />
        <button className="btn-primary rounded-xl px-6 py-3 w-full sm:w-auto">
          {TIERS.find(t => t.id === selected)?.cta}
        </button>
        <span className="text-xs text-gray-500">
          7-day refund · Cancel anytime · Secure checkout via Stripe
        </span>
      </form>
      {children}
    </div>
  );
}
