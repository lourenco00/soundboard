"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [err,setErr]=useState("");
  const router = useRouter();
  async function submit(e:any){ e.preventDefault(); setErr("");
    const r = await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});
    const j = await r.json(); if(!r.ok) return setErr(j.error||"Failed");
    router.push("/");
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Log in</h1>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full bg-white/10 rounded-md px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="w-full bg-white/10 rounded-md px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          {err && <div className="text-red-400 text-sm">{err}</div>}
          <button className="btn-primary rounded-xl w-full">Log in</button>
        </form>
        <div className="text-sm text-gray-400 mt-3">No account? <Link href="/signup" className="underline">Create one</Link></div>
      </div>
    </div>
  );
}