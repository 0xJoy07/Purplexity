'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function ResetPasswordPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.auth-logo-wrap', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.5)' });
      gsap.fromTo(cardRef.current, { opacity: 0, y: 40, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out', delay: 0.2 });
      gsap.fromTo('.auth-field', { opacity: 0, x: -15 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.1, delay: 0.4 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setSuccess(true);
      setTimeout(() => router.replace('/signin'), 3000);
    } catch (err: any) {
      setError(err.message);
      gsap.fromTo(cardRef.current, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)', repeat: 3, yoyo: true });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page-root">
        <div className="auth-card" style={{ opacity: 1, textAlign: 'center' }}>
          <p className="auth-card-desc text-red-500">Invalid reset link.</p>
          <Link href="/forgot-password" className="auth-submit-btn mt-4 inline-flex no-underline">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="auth-page-root">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-grid" />

      <div className="auth-logo-wrap">
        <img src="/logo.png" alt="Purplexity" className="h-8 w-auto" />
        <span className="auth-logo-text">purplexity</span>
      </div>

      <div ref={cardRef} className="auth-card">
        {success ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }} className="auth-success py-4">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-accent" />
            <h2 className="auth-card-title">Password updated!</h2>
            <p className="auth-card-desc mt-1">Redirecting you to sign in…</p>
          </motion.div>
        ) : (
          <>
            <div className="auth-card-header">
              <h1 className="auth-card-title">Set a new password</h1>
              <p className="auth-card-desc">Choose a strong password for your account.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="auth-field space-y-1.5">
                <label className="auth-label">New password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" className="auth-input pr-10" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="auth-field space-y-1.5">
                <label className="auth-label">Confirm password</label>
                <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat new password" className="auth-input" />
              </div>
              {error && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="auth-error">{error}</motion.div>}
              <button type="submit" disabled={isLoading} className="auth-submit-btn auth-field">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Updating…' : 'Update password'}
              </button>
            </form>
            <div className="auth-field mt-2 flex justify-center">
              <Link href="/signin" className="auth-link text-sm">Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
