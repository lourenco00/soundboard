"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Form = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
  confirm: string;
  agree: boolean;
  marketing: boolean;
};

export default function SignupPage() {
  const [f, setF] = useState<Form>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    agree: false,
    marketing: false,
  });
  const [err, setErr] = useState("");
  const router = useRouter();

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: any) {
    e.preventDefault();
    setErr("");

    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (f.password !== f.confirm) return setErr("Passwords don’t match.");
    if (!f.agree) return setErr("Please accept the Terms to continue.");

    const payload = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      username: f.username.trim(),
      email: f.email.trim(),
      phone: f.phone?.trim() || undefined,
      password: f.password,
      marketing: f.marketing,
    };

    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) return setErr(j.error || "Signup failed");

    // If your flow sends a verification email, you can redirect to a verify page here.
    router.push("/"); // or router.push("/verify-email")
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-6">
          <Image
            src="/soundboardlab.png"
            alt="Soundboard Lab"
            width={36}
            height={36}
            className="rounded-xl"
            priority
          />
          <span className="text-xl font-semibold tracking-wide">Soundboard Lab</span>
        </Link>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-xl font-semibold mb-1">Create your account</h1>
          <p className="text-sm text-gray-400 mb-4">Free plan includes 5 uploads. Upgrade anytime.</p>

          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                className="bg-white/10 rounded-md px-3 py-2"
                placeholder="First name"
                value={f.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
              <input
                className="bg-white/10 rounded-md px-3 py-2"
                placeholder="Last name"
                value={f.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </div>

            <input
              className="w-full bg-white/10 rounded-md px-3 py-2"
              placeholder="Username"
              value={f.username}
              onChange={(e) => set("username", e.target.value)}
              required
            />

            <input
              className="w-full bg-white/10 rounded-md px-3 py-2"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />

            <input
              className="w-full bg-white/10 rounded-md px-3 py-2"
              placeholder="Phone (optional)"
              type="tel"
              autoComplete="tel"
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
            />

            <input
              className="w-full bg-white/10 rounded-md px-3 py-2"
              placeholder="Password (min 8 chars)"
              type="password"
              autoComplete="new-password"
              value={f.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />

            <input
              className="w-full bg-white/10 rounded-md px-3 py-2"
              placeholder="Confirm password"
              type="password"
              autoComplete="new-password"
              value={f.confirm}
              onChange={(e) => set("confirm", e.target.value)}
              required
            />

            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={f.agree}
                onChange={(e) => set("agree", e.target.checked)}
                className="mt-1"
                required
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={f.marketing}
                onChange={(e) => set("marketing", e.target.checked)}
                className=""
              />
              <span>Send me product updates and tips (optional)</span>
            </label>

            {err && <div className="text-red-400 text-sm">{err}</div>}
            <button className="btn-primary rounded-xl w-full">Create account</button>
          </form>

          <div className="text-sm text-gray-400 mt-3">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
