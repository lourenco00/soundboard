"use client";
import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [done,setDone]=useState(false); const [err,setErr]=useState("");
  async function submit(e:any){ e.preventDefault(); setErr("");
    const r = await fetch("/api/auth/signup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});
    const j = await r.json(); if(!r.ok) return setErr(j.error||"Failed");
    setDone(true);
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Create account</h1>
        {done ? (<p>Check your inbox to verify your email.</p>) : (
          <form onSubmit={submit} className="space-y-3">
            <input className="w-full bg-white/10 rounded-md px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="w-full bg-white/10 rounded-md px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <button className="btn-primary rounded-xl w-full">Sign up</button>
          </form>
        )}
        <div className="text-sm text-gray-400 mt-3">Already have an account? <Link href="/login" className="underline">Log in</Link></div>
      </div>
    </div>
  );
}