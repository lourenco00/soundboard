"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const FEATURES = [
  {
    title: "AI Sample Forge",
    desc: "Type a vibe — get a stem. Our generative engine crafts kicks, snares, vocals, and atmospheres on demand.",
    icon: "✨",
    tint: "from-violet-500/30 to-fuchsia-500/20",
  },
  {
    title: "Pro DAW Timeline",
    desc: "Arrange, slice, and bounce. Multitrack timeline with real-time waveform editing.",
    icon: "🎚",
    tint: "from-pink-500/30 to-rose-500/20",
  },
  {
    title: "Step Sequencer & Piano",
    desc: "Classic 16-step grid and a chromatic piano with onboard synth presets.",
    icon: "🎹",
    tint: "from-cyan-500/30 to-sky-500/20",
  },
  {
    title: "MIDI Ready",
    desc: "Plug in your controller. We map velocity, notes, and CCs out of the box.",
    icon: "🎛",
    tint: "from-emerald-500/30 to-teal-500/20",
  },
  {
    title: "FX Rack",
    desc: "Reverb, delay, filter, sidechain, bitcrusher — everything routed to a master bus.",
    icon: "💫",
    tint: "from-amber-500/30 to-orange-500/20",
  },
  {
    title: "Cloud Presets",
    desc: "Save your kits to the cloud. Share a link, collaborate, ship the beat.",
    icon: "☁️",
    tint: "from-indigo-500/30 to-violet-500/20",
  },
];

const TESTIMONIALS = [
  { name: "Jules R.", role: "Bedroom Producer", quote: "Replaced three apps in my workflow. The AI sample forge is genuinely insane.", avatar: "🦄" },
  { name: "Marco V.", role: "Hip-Hop Engineer", quote: "I make a beat in 8 minutes flat. Soundboard Lab is what Ableton would build if it were born on the web.", avatar: "🎤" },
  { name: "Aiko N.", role: "Streamer / VTuber", quote: "Drag, drop, smash a key, ship it to OBS. My chat thinks I have a real studio behind me.", avatar: "👾" },
];

const STATS = [
  { value: "210k+", label: "Beats produced" },
  { value: "12k", label: "Active creators" },
  { value: "4.9★", label: "App rating" },
  { value: "<8 min", label: "Avg. first beat" },
];

export default function Landing() {
  const [bpm, setBpm] = useState(124);
  useEffect(() => {
    const id = setInterval(() => setBpm(b => 118 + Math.floor(Math.random() * 14)), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative">
      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 lg:pt-20 lg:pb-24 grid grid-cols-12 gap-8 items-center">
        <div className="col-span-12 lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-violet-200/90 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            New · AI Sample Forge is live
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            The studio that fits in <span className="gradient-text">your browser.</span>
          </h1>
          <p className="mt-5 text-lg text-gray-300/90 max-w-2xl">
            Soundboard Lab is the production suite for the next generation of creators —
            pads, sequencer, piano, multitrack DAW, AI samples, and a live mixer. No installs.
            No friction. Just sound.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-primary rounded-xl px-6 py-3 text-base">
              Start free — no card
            </Link>
            <Link href="/login" className="btn-outline rounded-xl px-6 py-3 text-base">
              Log in
            </Link>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-gray-200 ml-1">
              See pricing →
            </a>
          </div>

          {/* trust strip */}
          <div className="mt-8 flex items-center gap-5 text-[11px] uppercase tracking-widest text-gray-500">
            <span>Trusted by</span>
            <span className="text-gray-300">SoundCloud</span>
            <span className="text-gray-300">Splice</span>
            <span className="text-gray-300">Twitch</span>
            <span className="text-gray-300">YouTube</span>
          </div>
        </div>

        {/* hero visual */}
        <div className="col-span-12 lg:col-span-5">
          <div className="glass-strong rounded-3xl p-5 relative overflow-hidden float-y">
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-violet-500/30 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-pink-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-gray-300">Live preview</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">BPM</span>
                  <span className="text-sm font-mono text-violet-200">{bpm}</span>
                </div>
              </div>

              {/* fake EQ */}
              <div className="h-28 rounded-2xl bg-black/40 border border-white/10 flex items-end gap-1 p-3">
                {Array.from({ length: 36 }).map((_, i) => (
                  <span
                    key={i}
                    className="bar-eq"
                    style={{ animationDelay: `${(i % 8) * 0.07}s`, animationDuration: `${0.9 + (i % 5) * 0.1}s` }}
                  />
                ))}
              </div>

              {/* fake pads */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {["Kick","Snare","Hat","Clap","Vox","808","FX","Pad"].map((p, i) => (
                  <div
                    key={p}
                    className={`rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-center text-xs ${
                      i === 0 ? "ring-2 ring-violet-400/60" : i === 3 ? "ring-2 ring-pink-400/60" : ""
                    }`}
                  >
                    <div className="text-[9px] text-gray-400 uppercase tracking-widest">Pad {i + 1}</div>
                    <div className="font-semibold text-gray-100">{p}</div>
                  </div>
                ))}
              </div>

              {/* fader strip */}
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">A</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-violet-500 to-pink-500" />
                </div>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">B</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map(s => (
            <div key={s.label} className="glass rounded-2xl p-5 text-center">
              <div className="text-2xl md:text-3xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs uppercase tracking-widest text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="text-xs uppercase tracking-widest text-violet-300 mb-3">Everything you need to ship</div>
          <h2 className="text-3xl md:text-4xl font-bold">A full studio, reimagined for the web.</h2>
          <p className="mt-3 text-gray-400">
            Soundboard Lab consolidates pads, sequencing, mixing, and AI generation into one
            buttery-smooth canvas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className={`glass rounded-2xl p-6 relative overflow-hidden group`}>
              <div className={`absolute -top-20 -right-20 w-44 h-44 rounded-full bg-gradient-to-br ${f.tint} blur-3xl opacity-70 group-hover:opacity-100 transition`} />
              <div className="relative">
                <div className="text-3xl mb-3">{f.icon}</div>
                <div className="font-semibold text-lg">{f.title}</div>
                <div className="text-sm text-gray-400 mt-2 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="glass-strong rounded-3xl p-8 md:p-12 grid grid-cols-12 gap-8 items-center">
          <div className="col-span-12 lg:col-span-6">
            <div className="text-xs uppercase tracking-widest text-pink-300 mb-3">Built for speed</div>
            <h3 className="text-2xl md:text-3xl font-bold">From blank canvas to release-ready in under 10 minutes.</h3>
            <ul className="mt-6 space-y-3 text-gray-300">
              {[
                "Pick a vibe — Soundboard Lab loads a starter kit",
                "Tap the pads or smash A S D F to build the loop",
                "Slide it into the DAW timeline and arrange your track",
                "Bounce a master-ready WAV and post it everywhere",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-12 lg:col-span-6">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs text-gray-400 mb-3">Step Sequencer · 16 steps</div>
              <div className="space-y-1.5">
                {["Kick","Snare","Hat","Clap"].map((row, r) => (
                  <div key={row} className="flex items-center gap-2">
                    <div className="w-12 text-[10px] uppercase tracking-widest text-gray-400">{row}</div>
                    <div className="flex-1 grid grid-cols-16 gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
                      {Array.from({ length: 16 }).map((_, c) => {
                        const on =
                          (r === 0 && c % 4 === 0) ||
                          (r === 1 && (c === 4 || c === 12)) ||
                          (r === 2 && c % 2 === 0) ||
                          (r === 3 && c === 6);
                        return (
                          <div
                            key={c}
                            className={`h-5 rounded ${on ? "bg-gradient-to-br from-violet-500 to-pink-500 shadow-md" : "bg-white/5 border border-white/10"}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest text-cyan-300 mb-3">Loved by creators</div>
          <h2 className="text-3xl md:text-4xl font-bold">Producers ship more on Soundboard Lab.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="glass rounded-2xl p-6">
              <div className="text-3xl mb-3">{t.avatar}</div>
              <p className="text-gray-200 leading-relaxed">"{t.quote}"</p>
              <div className="mt-4 text-sm">
                <div className="font-semibold">{t.name}</div>
                <div className="text-gray-400">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest text-violet-300 mb-3">Pricing</div>
          <h2 className="text-3xl md:text-4xl font-bold">Free to start. Upgrade when you're ready to ship.</h2>
          <p className="mt-3 text-gray-400">Cancel anytime. No questions asked.</p>
        </div>
        <PricingGrid />
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="glass-strong rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold">Ready to make some noise?</h2>
            <p className="mt-3 text-gray-300 max-w-xl mx-auto">
              Join thousands of creators turning ideas into tracks on Soundboard Lab — your full studio, one URL away.
            </p>
            <div className="mt-7 flex justify-center gap-3 flex-wrap">
              <Link href="/signup" className="btn-primary rounded-xl px-6 py-3 text-base">
                Get started — it's free
              </Link>
              <Link href="/login" className="btn-outline rounded-xl px-6 py-3 text-base">
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 py-10 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Image src="/soundboardlab.png" alt="Soundboard Lab" width={20} height={20} className="rounded" />
          <span>© {new Date().getFullYear()} Soundboard Lab</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/terms" className="hover:text-gray-300">Terms</Link>
          <Link href="/privacy" className="hover:text-gray-300">Privacy</Link>
          <a href="mailto:hello@soundboardlab.app" className="hover:text-gray-300">Contact</a>
        </div>
      </footer>
    </div>
  );
}

function PricingGrid() {
  const tiers = [
    {
      name: "Starter",
      price: "Free",
      sub: "Forever",
      cta: "Get started",
      href: "/signup",
      featured: false,
      features: [
        "3 pad banks (27 pads)",
        "Built-in sample library",
        "Step Sequencer · 16 steps",
        "Web MIDI controller support",
        "Local presets",
      ],
    },
    {
      name: "Studio",
      price: "$9",
      sub: "/month",
      cta: "Go Studio",
      href: "/signup",
      featured: true,
      features: [
        "Everything in Starter",
        "AI Sample Forge · 200 gens/mo",
        "Full DAW timeline + bounce to WAV",
        "Cloud presets & share links",
        "10-minute recording limit",
        "FX rack: reverb · delay · sidechain",
      ],
    },
    {
      name: "Producer",
      price: "$24",
      sub: "/month",
      cta: "Go Producer",
      href: "/signup",
      featured: false,
      features: [
        "Everything in Studio",
        "AI Sample Forge · unlimited",
        "Stem separation & vocal isolation",
        "Collaborative sessions (up to 4)",
        "Priority rendering & 320kbps export",
        "Commercial license included",
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {tiers.map(t => (
        <div
          key={t.name}
          className={`rounded-3xl p-7 relative ${
            t.featured ? "glass-strong gradient-border glow-violet" : "glass"
          }`}
        >
          {t.featured && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 pro-badge">Most popular</div>
          )}
          <div className="text-sm uppercase tracking-widest text-gray-400">{t.name}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl font-bold">{t.price}</span>
            <span className="text-sm text-gray-400">{t.sub}</span>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-gray-300">
            {t.features.map(f => (
              <li key={f} className="flex gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={t.href}
            className={`mt-6 block text-center rounded-xl px-4 py-3 font-medium ${
              t.featured ? "btn-primary" : "btn-outline"
            }`}
          >
            {t.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}
