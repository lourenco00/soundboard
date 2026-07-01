// app/api/forge/route.ts
// Turns a text prompt into a synthesis patch using a real LLM. Supports two
// providers, each resolvable from either the signed-in user's own stored key
// (Settings → AI Forge API keys) or a server-side fallback key:
//   - Claude  → user key, else ANTHROPIC_API_KEY  (official @anthropic-ai/sdk)
//   - OpenAI  → user key, else OPENAI_API_KEY      (official openai sdk)
// The model reads the words in the prompt and emits patch JSON, so every
// prompt produces a genuinely different sound. If no key is available for the
// chosen provider (or the call fails), we fall back to a prompt-keyword
// heuristic so the Forge still varies its output.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { requireUser, requireUserOrThrow } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import {
  parsePatch,
  heuristicPatch,
  type ForgePatch,
  type ForgeRequest,
} from "@/lib/forge/patch";

const CLAUDE_MODEL = process.env.FORGE_CLAUDE_MODEL || "claude-opus-4-8";
const OPENAI_MODEL = process.env.FORGE_OPENAI_MODEL || "gpt-4o";

type Provider = "claude" | "openai";
type KeySource = "user" | "server";

/** Resolve which key (if any) is usable for a provider, and where it came from. */
function resolveKey(
  provider: Provider,
  user: { anthropicKeyEnc?: string | null; openaiKeyEnc?: string | null } | null
): { apiKey: string; source: KeySource } | null {
  const encrypted = provider === "claude" ? user?.anthropicKeyEnc : user?.openaiKeyEnc;
  if (encrypted) {
    try {
      return { apiKey: decryptSecret(encrypted), source: "user" };
    } catch (e) {
      console.error(`[forge] failed to decrypt stored ${provider} key:`, e);
    }
  }
  const serverKey = provider === "claude" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  return serverKey ? { apiKey: serverKey, source: "server" } : null;
}

const SYSTEM_PROMPT = `You are a sound-design engine for a browser synthesizer. Given a short text
description of a sound plus musical parameters, you output ONE JSON object (and
nothing else) describing how to synthesize it.

Translate the MEANING of the words into synthesis parameters. Two different
descriptions must produce two different patches — "dark trap kick" and "bright
glassy pluck" should not look alike. Interpret adjectives:
- dark/deep/sub -> low filter cutoff, low frequencies, sine/triangle
- bright/glassy/airy -> high cutoff, saw/square, higher frequencies
- dirty/gritty/distorted/aggressive -> master.drive up, resonant filter, saw
- detuned/wide/super/thick -> unison 2-3, detune 8-25 cents, pan spread
- lo-fi/vinyl/warm -> softer highs, pink noise, gentle drive
- punchy/snappy -> fast attack, short decay
- pad/evolving/lush -> long attack & release, sustain > 0

SCHEMA (all numbers must stay in range; omit optional fields to accept defaults):
{
  "name": string,
  "durationMs": 120..6000,
  "master": { "gain": 0..1, "drive": 0..1 },
  "layers": [ 1..6 of {
    "source": "osc" | "noise",
    "waveform": "sine" | "sawtooth" | "square" | "triangle",   // osc
    "noiseType": "white" | "pink",                              // noise
    "freqStart": 20..18000, "freqEnd": 20..18000,               // freqEnd != freqStart = pitch sweep
    "freqCurve": "linear" | "exp",
    "detune": -1200..1200 (cents), "unison": 1..3,
    "gain": 0..1, "pan": -1..1,
    "amp": { "attack": 0..4, "decay": 0..8, "sustain": 0..1, "release": 0..8 },  // seconds
    "filter": { "type": "lowpass"|"highpass"|"bandpass", "freqStart": 20..20000, "freqEnd": 20..20000, "q": 0.1..24 }
  } ]
}

Drums usually layer a pitched body (osc) with a noise transient. Use the given
key for tonal sounds (bass/lead/pad/vox). Respect the requested duration and let
"intensity" push drive, brightness, and length. Output only the JSON object.`;

function userPrompt(req: ForgeRequest): string {
  return `Description: ${req.prompt}
Sound type: ${req.preset}
Key: ${req.keyRoot}
BPM: ${req.bpm}
Target duration (ms): ${req.durationMs}
Intensity (0..1): ${req.intensity}

Return the JSON patch now.`;
}

/** Pull the first balanced JSON object out of a model's text response. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object in model output");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error("Unbalanced JSON in model output");
}

async function generateWithClaude(req: ForgeRequest, apiKey: string): Promise<ForgePatch> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    output_config: { effort: "low" }, // interactive tool — keep latency low
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt(req) }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parsePatch(extractJson(text));
}

async function generateWithOpenAI(req: ForgeRequest, apiKey: string): Promise<ForgePatch> {
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(req) },
    ],
  });
  const text = res.choices[0]?.message?.content || "";
  return parsePatch(extractJson(text));
}

/** GET → which providers are usable right now (server key and/or the signed-in user's own key). */
export async function GET() {
  const user = await requireUser(); // non-throwing; null if not signed in
  const claudeKey = resolveKey("claude", user);
  const openaiKey = resolveKey("openai", user);

  return NextResponse.json({
    // Kept for backward compatibility with the current Forge UI.
    providers: [claudeKey && "claude", openaiKey && "openai"].filter(Boolean),
    detail: {
      claude: { available: !!claudeKey, source: claudeKey?.source ?? null },
      openai: { available: !!openaiKey, source: openaiKey?.source ?? null },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUserOrThrow();
    const body = await req.json();

    const forgeReq: ForgeRequest = {
      prompt: String(body?.prompt || "").slice(0, 500),
      preset: String(body?.preset || "kick"),
      bpm: Number(body?.bpm) || 120,
      keyRoot: String(body?.keyRoot || "C"),
      durationMs: Math.min(6000, Math.max(120, Number(body?.durationMs) || 1200)),
      intensity: Math.min(1, Math.max(0, Number(body?.intensity) ?? 0.7)),
    };

    if (!forgeReq.prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const resolved: Partial<Record<Provider, { apiKey: string; source: KeySource }>> = {
      claude: resolveKey("claude", user) ?? undefined,
      openai: resolveKey("openai", user) ?? undefined,
    };
    const available = (["claude", "openai"] as Provider[]).filter((p) => resolved[p]);
    const requested = body?.provider as Provider | "auto" | undefined;

    let provider: Provider | null = null;
    if (requested && requested !== "auto") {
      provider = available.includes(requested) ? requested : null;
    } else {
      provider = available[0] ?? null;
    }

    if (provider) {
      const key = resolved[provider]!;
      try {
        const patch =
          provider === "claude"
            ? await generateWithClaude(forgeReq, key.apiKey)
            : await generateWithOpenAI(forgeReq, key.apiKey);
        return NextResponse.json({
          patch,
          provider,
          model: provider === "claude" ? CLAUDE_MODEL : OPENAI_MODEL,
          keySource: key.source,
          source: "ai",
        });
      } catch (e: any) {
        // Fall through to the heuristic so the user still gets a sound.
        console.error("[forge] AI generation failed:", e?.message || e);
      }
    }

    return NextResponse.json({
      patch: heuristicPatch(forgeReq),
      provider: null,
      model: null,
      keySource: null,
      source: "fallback",
      reason: available.length === 0 ? "no-provider-configured" : "ai-error",
    });
  } catch (e: any) {
    const status = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Sign in to use the Forge" : "Failed to generate" },
      { status }
    );
  }
}
