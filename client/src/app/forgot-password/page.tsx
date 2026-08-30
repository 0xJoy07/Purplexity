'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';

const API_BASE = process.env.API_BASE;

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="auth-orb auth-orb-1" style={{ animationDelay: '-2s' }} />
      <div className="auth-orb auth-orb-2" style={{ animationDelay: '-5s' }} />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-grid" />
    </div>
  );
}

export default function ForgotPasswordPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(logoRef.current, { opacity: 0, y: -30, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'back.out(1.7)', delay: 0.1 });
      gsap.fromTo(cardRef.current, { opacity: 0, y: 40, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out', delay: 0.25 });
      gsap.fromTo('.auth-field', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out', stagger: 0.1, delay: 0.5 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    gsap.to('.auth-submit-btn', { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 });

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reset email');
      setSuccess(true);
      gsap.to(cardRef.current, { scale: 1.02, duration: 0.15, yoyo: true, repeat: 1 });
    } catch (err: any) {
      setError(err.message);
      gsap.fromTo(cardRef.current, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)', repeat: 3, yoyo: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="auth-page-root">
      <FloatingOrbs />

      <div ref={logoRef} className="auth-logo-wrap">
        <img src="/logo.png" alt="Purplexity" className="h-8 w-auto" />
        <span className="auth-logo-text">purplexity</span>
      </div>

      <div ref={cardRef} className="auth-card">
        {success ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="auth-success py-4">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-accent" />
            <h2 className="auth-card-title text-center">Check your inbox</h2>
            <p className="auth-card-desc text-center">We sent a password reset link to <strong className="text-foreground">{email}</strong>. It expires in 30 minutes.</p>
            <Link href="/signin" className="auth-submit-btn mt-6 text-center no-underline">Back to Sign In</Link>
          </motion.div>
        ) : (
          <>
            <div className="auth-card-header">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <h1 className="auth-card-title">Forgot your password?</h1>
              <p className="auth-card-desc">Enter your email and we'll send you a reset link.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="auth-field space-y-1.5">
                <label className="auth-label">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="auth-input"
                  autoFocus
                />
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="auth-error">
                  {error}
                </motion.div>
              )}

              <button type="submit" disabled={isLoading} className="auth-submit-btn auth-field">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isLoading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <div className="auth-field mt-2 flex justify-center">
              <Link href="/signin" className="auth-link flex items-center gap-1.5 text-sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
