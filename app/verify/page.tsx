"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function VerifyPage() {
  const sp = useSearchParams(); const router = useRouter();
  const [msg,setMsg]=useState("Verifying…");
  useEffect(()=>{ const t=sp.get("token"); if(!t){setMsg("Missing token");return;}
    fetch("/api/auth/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:t})})
      .then(r=>r.json()).then(j=>{ if(j.ok){ setMsg("Verified! Redirecting…"); setTimeout(()=>router.push("/"),700); } else setMsg(j.error||"Failed");});
  },[]);
  return <div className="min-h-screen flex items-center justify-center"><div className="glass rounded-2xl p-8">{msg}</div></div>;
}