import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerifyEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = schema.parse(body);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  await prisma.verificationToken.create({ data: { userId: user.id, token, expiresAt } });

  const link = `${process.env.NEXT_PUBLIC_PUBLIC_URL}/verify?token=${token}`;
  await sendVerifyEmail(email, link);

  return NextResponse.json({ ok: true });
}