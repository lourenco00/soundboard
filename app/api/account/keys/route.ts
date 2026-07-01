// app/api/account/keys/route.ts
// Lets a signed-in user store their own Claude / OpenAI API key so AI Forge
// generations run against their account instead of (or before) the server's
// shared key. Keys are encrypted at rest (lib/crypto.ts) and never returned
// to the client in full — only a last-4 fingerprint for display.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOrThrow } from "@/lib/auth";
import { encryptSecret, last4 } from "@/lib/crypto";

type Provider = "anthropic" | "openai";

const PREFIXES: Record<Provider, string> = {
  anthropic: "sk-ant-",
  openai: "sk-",
};

function fieldNames(provider: Provider) {
  return provider === "anthropic"
    ? { enc: "anthropicKeyEnc", last4: "anthropicKeyLast4" } as const
    : { enc: "openaiKeyEnc", last4: "openaiKeyLast4" } as const;
}

export async function GET() {
  try {
    const user = await requireUserOrThrow();
    return NextResponse.json({
      anthropic: { configured: !!user.anthropicKeyEnc, last4: user.anthropicKeyLast4 },
      openai: { configured: !!user.openaiKeyEnc, last4: user.openaiKeyLast4 },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUserOrThrow();
    const body = await req.json().catch(() => ({}));
    const provider = body?.provider as Provider;
    const apiKey = String(body?.apiKey || "").trim();

    if (provider !== "anthropic" && provider !== "openai") {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    if (apiKey.length < 20 || apiKey.length > 400) {
      return NextResponse.json({ error: "That doesn't look like a valid API key" }, { status: 400 });
    }
    if (!apiKey.startsWith(PREFIXES[provider])) {
      return NextResponse.json(
        { error: `${provider === "anthropic" ? "Claude" : "OpenAI"} keys start with "${PREFIXES[provider]}"` },
        { status: 400 }
      );
    }

    const { enc, last4: last4Field } = fieldNames(provider);
    await prisma.user.update({
      where: { id: user.id },
      data: { [enc]: encryptSecret(apiKey), [last4Field]: last4(apiKey) },
    });

    return NextResponse.json({ ok: true, last4: last4(apiKey) });
  } catch (e: any) {
    if (e?.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[account/keys] save failed:", e?.message || e);
    return NextResponse.json({ error: "Failed to save key" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUserOrThrow();
    const body = await req.json().catch(() => ({}));
    const provider = body?.provider as Provider;

    if (provider !== "anthropic" && provider !== "openai") {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    const { enc, last4: last4Field } = fieldNames(provider);
    await prisma.user.update({
      where: { id: user.id },
      data: { [enc]: null, [last4Field]: null },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to remove key" }, { status: 500 });
  }
}
