'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.auth-card', { opacity: 0, y: 40, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No verification token found.'); return; }

    fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setStatus('success');
          setMessage('Your email is verified! Redirecting…');
          setTimeout(() => router.replace('/'), 2000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed.');
        }
      })
      .catch(() => { setStatus('error'); setMessage('Network error. Try again.'); });
  }, [token, router]);

  return (
    <div ref={containerRef} className="auth-page-root">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-grid" />

      <div className="auth-logo-wrap" style={{ opacity: 1 }}>
        <img src="/logo.png" alt="Purplexity" className="h-8 w-auto" />
        <span className="auth-logo-text">purplexity</span>
      </div>

      <div className="auth-card" style={{ opacity: 0 }}>
        <div className="py-4 text-center">
          {status === 'loading' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-accent" />
              <p className="text-sm text-text-muted">Verifying your email…</p>
            </motion.div>
          )}
          {status === 'success' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }}>
              <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-accent" />
              <h2 className="auth-card-title">Email verified!</h2>
              <p className="auth-card-desc mt-1">{message}</p>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <XCircle className="mx-auto mb-4 h-14 w-14 text-red-500" />
              <h2 className="auth-card-title">Verification failed</h2>
              <p className="auth-card-desc mt-1 text-red-500">{message}</p>
              <Link href="/signin" className="auth-submit-btn mt-6 inline-flex no-underline">Back to sign in</Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
