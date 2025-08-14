'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic'; // avoid prerender issues

function VerifyInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<'verifying'|'ok'|'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok) {
          setStatus('ok');
          setMessage('Email verified. Redirecting...');
          setTimeout(() => router.push('/'), 1500);
        } else {
          setStatus('error');
          setMessage(data?.error || 'Verification failed.');
        }
      } catch {
        setStatus('error');
        setMessage('Network error while verifying.');
      }
    })();
  }, [searchParams, router]);

  return (
    <main style={{minHeight:'60vh',display:'grid',placeItems:'center',padding:'2rem'}}>
      <div style={{padding:'1.25rem 1.5rem',border:'1px solid #e5e7eb',borderRadius:12,maxWidth:520,width:'100%',textAlign:'center'}}>
        <h1 style={{margin:'0 0 .5rem'}}>Verify email</h1>
        <p style={{margin:0,opacity:.85}}>{message}</p>
        {status === 'error' && (
          <div style={{marginTop:12,fontSize:14,opacity:.8}}>
            If this keeps happening, request a new link.
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <main style={{minHeight:'60vh',display:'grid',placeItems:'center'}}>Loading…</main>
    }>
      <VerifyInner />
    </Suspense>
  );
}
