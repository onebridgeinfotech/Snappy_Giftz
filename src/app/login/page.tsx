'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, Sparkles, Fingerprint } from 'lucide-react';
import { isPasskeySupported, passkeyLogin } from '@/lib/auth/passkey-client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check if already authenticated
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          router.push(redirectUrl);
        }
      })
      .catch(() => {});
  }, [router, redirectUrl]);

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  const handlePasskeyLogin = async () => {
    if (!email.trim()) {
      setErrorMsg('Enter your email first, then use Face ID / fingerprint.');
      return;
    }
    setPasskeyBusy(true);
    setErrorMsg(null);
    try {
      const res = await passkeyLogin(email);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Biometric sign-in failed.');
      router.push(redirectUrl);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Biometric sign-in failed.');
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <Sparkles className="w-6 h-6 text-[#F5BD48]" />
          <span className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#F5BD48] to-[#D5A34A]">
            SNAPPY GIFTZ
          </span>
        </Link>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-white">
          Sign In to Your Account
        </h2>
        <p className="mt-2 text-xs text-[#94A3B8]">
          Manage orders, personalize bespoke gifts, and track Hyderabad deliveries.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-[#17181C] py-8 px-6 shadow-2xl rounded-2xl border border-[#D5A34A]/25 sm:px-10">
          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#CBD5E1]">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#94A3B8]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-10 pl-10 pr-10 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#94A3B8] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || passkeyBusy}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer shadow-lg shadow-[#D5A34A]/10"
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {passkeySupported && (
              <button
                type="button"
                disabled={isLoading || passkeyBusy}
                onClick={() => void handlePasskeyLogin()}
                className="w-full h-11 rounded-xl border border-[#D5A34A]/40 bg-[#08090B] text-[#F5BD48] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#24252A] transition-colors disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{passkeyBusy ? 'Confirm Face ID…' : 'Sign in with Face ID / fingerprint'}</span>
              </button>
            )}
          </form>

          <div className="mt-6 pt-6 border-t border-[#D5A34A]/15 text-center text-xs text-[#94A3B8]">
            Don't have an account?{' '}
            <Link
              href={`/register${redirectUrl !== '/account' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
              className="text-[#F5BD48] font-semibold hover:underline"
            >
              Create Account
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link href="/" className="text-[11px] text-[#64748B] hover:text-[#CBD5E1]">
              &larr; Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08090B] flex items-center justify-center text-[#D5A34A]">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

