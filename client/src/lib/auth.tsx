'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

const API_BASE = 'http://localhost:5000';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  emailVerified: boolean;
  tokenLimit: number;
  tokensUsed: number;
  dailyTokenLimit: number;
  provider: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  loginWithGoogle: () => void;
  loginWithGithub: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch /me from our Express server using our JWT
  const fetchMe = useCallback(async (jwt: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user as AuthUser;
    } catch {
      return null;
    }
  }, []);

  // Sync a Supabase OAuth user to our Express backend and get our own JWT
  const syncOAuthUser = useCallback(async (supabaseUser: { email: string; name: string; avatar: string; provider: string }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/oauth-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supabaseUser),
      });
      if (!res.ok) throw new Error('OAuth sync failed');
      const data = await res.json();
      // data = { token, user }
      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      console.error('OAuth sync error:', err);
    }
  }, []);

  // Try to restore session from localStorage JWT
  const refreshUser = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('authToken');
      if (!storedToken) { setIsLoading(false); return; }
      const userData = await fetchMe(storedToken);
      if (userData) {
        setUser(userData);
        setToken(storedToken);
      } else {
        localStorage.removeItem('authToken');
        setUser(null);
        setToken(null);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  }, [fetchMe]);

  // On mount: check for Supabase OAuth session, then fall back to stored JWT
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // 1. Check if Supabase has a session (i.e., user just came back from OAuth)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        const meta = session.user.user_metadata || {};
        await syncOAuthUser({
          email: session.user.email || '',
          name: meta.full_name || meta.name || meta.user_name || session.user.email?.split('@')[0] || 'User',
          avatar: meta.avatar_url || meta.picture || '',
          provider: session.user.app_metadata?.provider || 'oauth',
        });
        // Sign out of Supabase — we only use it for the OAuth dance, our JWT handles everything else
        await supabase.auth.signOut();
        if (mounted) setIsLoading(false);
        return;
      }

      // 2. No Supabase session — try our stored JWT
      if (mounted) await refreshUser();
    };

    initAuth();

    // Listen for Supabase auth state changes (e.g., OAuth redirect back)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && mounted) {
        const meta = session.user.user_metadata || {};
        await syncOAuthUser({
          email: session.user.email || '',
          name: meta.full_name || meta.name || meta.user_name || session.user.email?.split('@')[0] || 'User',
          avatar: meta.avatar_url || meta.picture || '',
          provider: session.user.app_metadata?.provider || 'oauth',
        });
        await supabase.auth.signOut();
        if (mounted) setIsLoading(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [syncOAuthUser, refreshUser]);

  // ── Email/password login (our Express server) ───────────────────────────────
  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('authToken', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  // ── Register (our Express server) ───────────────────────────────────────────
  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = async () => {
    const stored = localStorage.getItem('authToken');
    try {
      if (stored) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${stored}` },
        });
      }
    } catch {}
    localStorage.removeItem('authToken');
    localStorage.removeItem('guestToken');
    localStorage.removeItem('guestUserId');
    setUser(null);
    setToken(null);
  };

  // ── OAuth via Supabase ──────────────────────────────────────────────────────
  const loginWithGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const loginWithGithub = () => {
    supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, loginWithGoogle, loginWithGithub, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
