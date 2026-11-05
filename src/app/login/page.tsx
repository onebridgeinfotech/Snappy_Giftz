'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Gift,
  Truck,
  ArrowLeft,
  X,
  KeyRound,
  ExternalLink,
  Crown
} from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';
import { getSafeRedirectUrl } from '@/lib/auth/redirect';

function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.36 7.33 24 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.59H1.24C.45 8.16 0 9.97 0 12s.45 3.84 1.24 5.41l4.04-3.13z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.13c.95-2.83 3.6-4.97 6.72-4.97z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'), '/');
  const oauthError = searchParams.get('oauth_error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'standard' | 'db_offline' | 'rate_limit'>('standard');

  // Modals for Forgot Password and Google OAuth info
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset' | 'success'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleStatusMsg, setGoogleStatusMsg] = useState<string | null>(null);

  // Pre-fill remembered email or check session
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('snappy_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
      }
    } catch {
      // Ignore localStorage restrictions
    }

    // Check if user is already authenticated
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          if (data.user.role === 'ADMIN' || data.user.role === 'STAFF') {
            router.push('/admin');
          } else {
            router.push(redirectUrl);
          }
        }
      })
      .catch(() => {});
  }, [router, redirectUrl]);

  // Handle URL error parameters (e.g. from OAuth redirect)
  useEffect(() => {
    if (oauthError === 'google_pending_credentials') {
      setGoogleStatusMsg(
        'Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are awaiting setup in Hostinger environment variables by the technical lead.'
      );
      setShowGoogleModal(true);
    }
  }, [oauthError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Client-side format validations
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      setErrorType('standard');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (e.g., name@example.com).');
      setErrorType('standard');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      setErrorType('standard');
      return;
    }

    setIsLoading(true);

    try {
      // Remember me preference
      try {
        if (rememberMe) {
          localStorage.setItem('snappy_remembered_email', cleanEmail);
        } else {
          localStorage.removeItem('snappy_remembered_email');
        }
      } catch {
        // Safe fallback
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setErrorType('rate_limit');
          throw new Error(data.error || 'Too many attempts. Please try again after 60 seconds.');
        }

        if (res.status === 503 || data.code === 'DATABASE_UNAVAILABLE') {
          setErrorType('db_offline');
          throw new Error(
            'Authentication database is temporarily unreachable. Hostinger MySQL connection is awaiting configuration by the technical lead.'
          );
        }

        setErrorType('standard');
        throw new Error(data.error || 'Invalid email or password. Please verify your credentials.');
      }

      // Role-based routing verified by server: full navigation ensures fresh session state & proxy validation
      if (data.user?.role === 'ADMIN' || data.user?.role === 'STAFF') {
        window.location.href = '/admin';
      } else {
        window.location.href = redirectUrl;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const googleAuthEndpoint = `/api/auth/google${redirectUrl !== '/' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`;
      const res = await fetch(googleAuthEndpoint, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();

      if (!res.ok || !data.configured) {
        setGoogleStatusMsg(
          data.message ||
            'Google OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) are awaiting configuration in the Hostinger environment variables by the technical lead.'
        );
        setShowGoogleModal(true);
      } else {
        // When real Google credentials exist, redirect to OAuth provider
        window.location.href = data.url || googleAuthEndpoint;
      }
    } catch {
      setGoogleStatusMsg(
        'Google OAuth configuration is currently pending Hostinger environment variables. Please use email & password or browse as guest.'
      );
      setShowGoogleModal(true);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, purpose: 'PASSWORD_RESET' }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(data.error || 'Too many verification code requests. Please wait a minute.');
        }
        if (res.status === 503 || data.code === 'DATABASE_UNAVAILABLE') {
          throw new Error('Authentication database is temporarily unreachable. Hostinger MySQL connection is awaiting configuration.');
        }
        throw new Error(data.error || 'Failed to dispatch verification code.');
      }

      setForgotSuccess(`A 6-digit verification code has been dispatched to ${cleanEmail}.`);
      setForgotStep('reset');
      setResendCooldown(60);
    } catch (err: any) {
      setForgotError(
        err.message ||
          'Password reset is temporarily unavailable while the database and SMTP service are pending configuration.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || forgotLoading) return;
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, purpose: 'PASSWORD_RESET' }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend verification code.');
      }

      setForgotSuccess('A fresh 6-digit verification code has been dispatched.');
      setResendCooldown(60);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    const cleanOtp = forgotOtp.trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setForgotError('Please enter the valid 6-digit verification code.');
      return;
    }

    if (!forgotNewPassword) {
      setForgotError('Please enter your new password.');
      return;
    }

    if (forgotNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[a-zA-Z]/.test(forgotNewPassword) || !/[0-9]/.test(forgotNewPassword)) {
      setForgotError('Password must contain at least one letter and one number.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('New passwords do not match. Please verify.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanOtp,
          newPassword: forgotNewPassword,
          confirmPassword: forgotConfirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(data.error || 'Too many attempts. Please try again after 60 seconds.');
        }
        if (res.status === 503 || data.code === 'DATABASE_UNAVAILABLE') {
          throw new Error('Authentication database is temporarily unreachable. Hostinger MySQL connection is awaiting configuration.');
        }
        throw new Error(data.error || 'Failed to reset password. Please check your verification code.');
      }

      setForgotStep('success');
      setForgotSuccess(data.message || 'Your password has been successfully updated.');
      setEmail(cleanEmail);
      setPassword('');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] flex flex-col justify-between selection:bg-[#D5A34A] selection:text-[#08090B]">
      {/* ========================================================================= */}
      {/* 1. TOP UTILITY HEADER — Back to Storefront & Security Badge               */}
      {/* ========================================================================= */}
      <nav className="w-full border-b border-[#D5A34A]/15 bg-[#08090B]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3.5 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#CBD5E1] hover:text-[#F5BD48] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#D5A34A] group-hover:-translate-x-1 transition-transform" />
            <span>Return to Storefront</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-[#94A3B8]">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#17181C] border border-[#D5A34A]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EC3E98] shadow-[0_0_8px_#EC3E98]" />
              <span className="text-[#CBD5E1] font-mono">Bespoke Atelier</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#CBD5E1]">
              <ShieldCheck className="w-4 h-4 text-[#D5A34A]" />
              <span>256-Bit SSL Encrypted</span>
            </span>
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. MAIN TWO-COLUMN CONTAINER (Responsive: 1-col mobile, 2-col desktop)     */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 my-auto flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
          
          {/* --------------------------------------------------------------------- */}
          {/* LEFT SECTION: Brand Artwork, Luxury Visual Area & Value Highlights    */}
          {/* --------------------------------------------------------------------- */}
          <section className="lg:col-span-6 xl:col-span-7 space-y-4 sm:space-y-6">
            <div className="relative rounded-3xl overflow-hidden border border-[#D5A34A]/25 bg-[#17181C] p-5 sm:p-8 lg:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
              {/* Subtle Ambient Background Artwork with Deep Luxury Vignette */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
                style={{ backgroundImage: `url('/assets/hero_dark_luxury_gift.jpg')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#17181C] via-[#17181C]/90 to-[#08090B]/80 pointer-events-none" />

              <div className="relative z-10 space-y-4 sm:space-y-6">
                {/* Logo & Category Pill */}
                <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                  <Link href="/" className="inline-block group focus:outline-hidden" title="SNAPPY GIFTZ Home">
                    <img
                      src="/assets/snappy-gifts.png"
                      alt="SNAPPY GIFTZ — Turning Moments Into Memories"
                      className="h-10 sm:h-12 lg:h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02] drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                    />
                  </Link>

                  {/* Dark Pink Subtle Brand Accent Pill */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EC3E98]/10 border border-[#EC3E98]/30 text-[#EC3E98] text-[10.5px] sm:text-[11px] font-semibold tracking-wider uppercase shadow-[0_0_12px_rgba(236,62,152,0.15)]">
                    <Sparkles className="w-3.5 h-3.5 text-[#EC3E98]" />
                    <span>Hyderabad Luxury Gifting</span>
                  </div>
                </div>

                {/* Brand Philosophy & Typography */}
                <div className="space-y-2 sm:space-y-3">
                  <h1 className="font-serif text-xl sm:text-2xl lg:text-4xl text-white font-bold leading-tight tracking-tight">
                    Turning Moments{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88528]">
                      Into Lasting Memories
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-[#CBD5E1]/85 leading-relaxed font-light max-w-xl">
                    Welcome to SNAPPY GIFTZ. Sign in to seamlessly review your bespoke personalization proofs, track insured express Hyderabad deliveries, and access your curated gift collection.
                  </p>
                </div>

                {/* 3 Luxury Pillars (Prominent on desktop, compressed on mobile for immediate form access) */}
                <div className="hidden lg:grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                  <div className="bg-[#08090B]/70 border border-[#D5A34A]/20 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#F5BD48]">
                      <Sparkles className="w-4 h-4 shrink-0 text-[#D5A34A]" />
                      <span className="text-xs font-bold text-white">24K Laser Engraving</span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-normal font-light">
                      Real-time live proofing with master craftsman precision.
                    </p>
                  </div>

                  <div className="bg-[#08090B]/70 border border-[#D5A34A]/20 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#F5BD48]">
                      <Truck className="w-4 h-4 shrink-0 text-[#D5A34A]" />
                      <span className="text-xs font-bold text-white">Insured Delivery</span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-normal font-light">
                      Same-day and express dispatch across Hyderabad PIN codes.
                    </p>
                  </div>

                  <div className="bg-[#08090B]/70 border border-[#D5A34A]/20 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#F5BD48]">
                      <Gift className="w-4 h-4 shrink-0 text-[#D5A34A]" />
                      <span className="text-xs font-bold text-white">Flat ₹20 Gift Wrap</span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-normal font-light">
                      Wax-sealed card, luxury satin ribbon, and keepsake box.
                    </p>
                  </div>
                </div>

                {/* Atelier Quality Guarantee Note (Desktop) */}
                <div className="hidden lg:flex bg-[#24252A]/50 border border-[#D5A34A]/15 rounded-2xl p-3.5 items-start gap-3">
                  <Crown className="w-4 h-4 text-[#D5A34A] shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-[#CBD5E1]/90 font-light leading-relaxed">
                    <strong className="text-white font-medium">Guest Browsing Welcome:</strong> You do not need an account to explore our catalog, configure personalized items, or complete checkout.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------------------- */}
          {/* RIGHT SECTION: Premium Customer Login Form                            */}
          {/* --------------------------------------------------------------------- */}
          <section className="lg:col-span-6 xl:col-span-5">
            <div className="bg-[#17181C] border border-[#D5A34A]/30 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.9)] relative overflow-hidden">
              {/* Top Gold Foil Accent Border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#F5BD48] to-transparent" />

              {/* Form Heading & Subtext */}
              <div className="space-y-1.5 mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Sign In to Your Account
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-[#94A3B8] font-light">
                  Enter your credentials to access your orders and personalization drafts.
                </p>
              </div>

              {/* Error Message Alert */}
              {errorMsg && (
                <div
                  className={`mb-6 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                    errorType === 'db_offline'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : errorType === 'rate_limit'
                      ? 'bg-orange-950/40 border-orange-500/40 text-orange-200'
                      : 'bg-red-950/50 border-red-500/40 text-red-300'
                  }`}
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div className="space-y-1">
                    <div className="font-semibold">{errorMsg}</div>
                    {errorType === 'db_offline' && (
                      <div className="text-[11px] text-[#CBD5E1]/80">
                        Notice for Lead: Hostinger MySQL database access rule is pending. Storefront operates smoothly in guest mode.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Real Interactive Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
                {/* Email Address Input */}
                <div>
                  <label htmlFor="login-email" className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                    Email Address <span className="text-[#F5BD48]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#94A3B8]" />
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      disabled={isLoading}
                      className="w-full h-11 sm:h-12 pl-10 pr-4 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-sm text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-semibold text-[#CBD5E1]">
                      Password <span className="text-[#F5BD48]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotStep('request');
                        setForgotOtp('');
                        setForgotNewPassword('');
                        setForgotConfirmPassword('');
                        setForgotError(null);
                        setForgotSuccess(null);
                        setShowForgotModal(true);
                      }}
                      className="text-xs text-[#F5BD48] hover:text-white font-medium hover:underline transition-colors focus:outline-hidden cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#94A3B8]" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={isLoading}
                      className="w-full h-11 sm:h-12 pl-10 pr-11 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-sm text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-3.5 text-[#94A3B8] hover:text-[#F5BD48] transition-colors focus:outline-hidden cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Option */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#CBD5E1] select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[#D5A34A]/40 bg-[#08090B] text-[#D5A34A] focus:ring-[#D5A34A] focus:ring-offset-0 cursor-pointer accent-[#D5A34A]"
                    />
                    <span>Remember me for 30 days</span>
                  </label>
                </div>

                {/* Primary Gold Login Button */}
                <button
                  type="submit"
                  disabled={isLoading || googleLoading}
                  className="w-full h-11 sm:h-12 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#D5A34A]/20"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#08090B] border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <>
                      <span>Sign In to Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Elegant Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#D5A34A]/20" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-[#17181C] text-[11px] font-semibold text-[#94A3B8] tracking-widest uppercase">
                    Or Continue With
                  </span>
                </div>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || googleLoading}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#08090B] border border-[#D5A34A]/30 text-white hover:border-[#D5A34A] hover:bg-[#24252A]/40 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[#CBD5E1]">
                    <span className="w-4 h-4 border-2 border-[#F5BD48] border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to Google...</span>
                  </div>
                ) : (
                  <>
                    <GoogleIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span>Continue with Google</span>
                    <span className="hidden sm:inline-block text-[10px] bg-[#24252A] text-[#94A3B8] px-2 py-0.5 rounded-full border border-[#D5A34A]/20">
                      OAuth 2.0
                    </span>
                  </>
                )}
              </button>

              {/* Links: Create Account & Guest Navigation */}
              <div className="mt-6 pt-5 border-t border-[#D5A34A]/15 space-y-3 text-center">
                <div className="text-xs text-[#94A3B8]">
                  Don't have an account?{' '}
                  <Link
                    href={`/register${redirectUrl !== '/' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
                    className="text-[#F5BD48] font-semibold hover:underline inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Create Account</span>
                  </Link>
                </div>

                <div>
                  <Link
                    href="/"
                    className="text-xs text-[#64748B] hover:text-[#CBD5E1] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Prefer guest checkout? Browse Storefront &rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. FOOTER COPYRIGHT & ATELIER INFO                                        */}
      {/* ========================================================================= */}
      <footer className="w-full border-t border-[#D5A34A]/15 bg-[#08090B] px-4 sm:px-6 lg:px-8 py-4 text-center text-[11px] text-[#64748B] z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} {BUSINESS_CONFIG.brandName}. All rights reserved. Hyderabad, India.</span>
          <div className="flex items-center gap-4 text-[#94A3B8]">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/shipping-policy" className="hover:text-white transition-colors">Shipping &amp; Delivery</Link>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 4. MODAL: FORGOT PASSWORD & PASSWORD RESET FLOW (3-Step Interactive)       */}
      {/* ========================================================================= */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 bg-[#08090B]/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-modal-title"
        >
          <div className="bg-[#17181C] border border-[#D5A34A]/35 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false);
                setForgotSuccess(null);
                setForgotError(null);
                setForgotStep('request');
              }}
              className="absolute right-5 top-5 text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header / Step Indicator */}
            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-[#D5A34A]/10 border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48] mb-2">
                {forgotStep === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <KeyRound className="w-5 h-5" />}
              </div>
              <h3 id="forgot-modal-title" className="font-serif text-xl font-bold text-white">
                {forgotStep === 'request' && 'Reset Your Password'}
                {forgotStep === 'reset' && 'Set New Password'}
                {forgotStep === 'success' && 'Password Reset Complete'}
              </h3>
              <p className="text-xs text-[#94A3B8] font-light">
                {forgotStep === 'request' && 'Enter your registered email address to receive a secure 6-digit verification code.'}
                {forgotStep === 'reset' && 'Enter the verification code sent to your email and create a strong new password.'}
                {forgotStep === 'success' && 'Your password has been updated securely. All previous active sessions have been revoked.'}
              </p>
            </div>

            {/* Feedback Alerts */}
            {forgotSuccess && forgotStep !== 'success' && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotError && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* STEP 1: Request Verification Code */}
            {forgotStep === 'request' && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                    Account Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#94A3B8]" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@example.com"
                      disabled={forgotLoading}
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:border-[#D5A34A] focus:outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {forgotLoading ? (
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-[#08090B] border-t-transparent rounded-full animate-spin" />
                      <span>Sending Code...</span>
                    </div>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Enter Code + Set New Password */}
            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#08090B] border border-[#D5A34A]/20 text-xs">
                  <div className="flex items-center gap-2 text-[#CBD5E1] truncate">
                    <Mail className="w-3.5 h-3.5 text-[#D5A34A] shrink-0" />
                    <span className="truncate">{forgotEmail}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('request');
                      setForgotError(null);
                    }}
                    className="text-[#F5BD48] hover:underline font-semibold text-[11px] shrink-0 ml-2 cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="forgot-otp" className="block text-xs font-semibold text-[#CBD5E1]">
                      6-Digit Verification Code
                    </label>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || forgotLoading}
                      onClick={handleResendOtp}
                      className="text-[11px] text-[#F5BD48] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                  <input
                    id="forgot-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    disabled={forgotLoading}
                    className="w-full h-11 px-4 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-center font-mono text-base tracking-[0.3em] text-[#F5BD48] placeholder-[#64748B] focus:border-[#F5BD48] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="forgot-new-password" className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#94A3B8]" />
                    <input
                      id="forgot-new-password"
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      disabled={forgotLoading}
                      className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:border-[#D5A34A] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3.5 top-3.5 text-[#94A3B8] hover:text-[#CBD5E1] cursor-pointer"
                      aria-label={showForgotNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="forgot-confirm-password" className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#94A3B8]" />
                    <input
                      id="forgot-confirm-password"
                      type={showForgotConfirmPassword ? 'text' : 'password'}
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      disabled={forgotLoading}
                      className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:border-[#D5A34A] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      className="absolute right-3.5 top-3.5 text-[#94A3B8] hover:text-[#CBD5E1] cursor-pointer"
                      aria-label={showForgotConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Policy Helpers */}
                <div className="p-2.5 rounded-xl bg-[#08090B]/60 border border-[#D5A34A]/15 space-y-1 text-[11px] text-[#94A3B8]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${forgotNewPassword.length >= 8 ? 'bg-emerald-400' : 'bg-[#64748B]'}`} />
                    <span className={forgotNewPassword.length >= 8 ? 'text-emerald-300' : ''}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${/[a-zA-Z]/.test(forgotNewPassword) && /[0-9]/.test(forgotNewPassword) ? 'bg-emerald-400' : 'bg-[#64748B]'}`} />
                    <span className={/[a-zA-Z]/.test(forgotNewPassword) && /[0-9]/.test(forgotNewPassword) ? 'text-emerald-300' : ''}>At least one letter and one number</span>
                  </div>
                  {forgotConfirmPassword && (
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${forgotNewPassword === forgotConfirmPassword ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span className={forgotNewPassword === forgotConfirmPassword ? 'text-emerald-300' : 'text-rose-300'}>
                        {forgotNewPassword === forgotConfirmPassword ? 'Passwords match' : 'Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || forgotOtp.length !== 6 || forgotNewPassword.length < 8 || forgotNewPassword !== forgotConfirmPassword}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {forgotLoading ? (
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-[#08090B] border-t-transparent rounded-full animate-spin" />
                      <span>Updating Password...</span>
                    </div>
                  ) : (
                    <span>Update Password & Secure Account</span>
                  )}
                </button>
              </form>
            )}

            {/* STEP 3: Success State */}
            {forgotStep === 'success' && (
              <div className="space-y-4 text-center py-2">
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs text-left leading-relaxed">
                  {forgotSuccess || 'Your password has been successfully updated.'} All previous active sessions on other browsers have been invalidated.
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotStep('request');
                    setForgotSuccess(null);
                    setForgotError(null);
                    const pwInput = document.getElementById('login-password');
                    if (pwInput) pwInput.focus();
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
                >
                  <span>Sign In with New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-[#D5A34A]/15 text-center text-xs text-[#94A3B8]">
              Need direct help? Contact our Concierge at{' '}
              <a href={`mailto:${BUSINESS_CONFIG.officialEmail}`} className="text-[#F5BD48] underline">
                {BUSINESS_CONFIG.officialEmail}
              </a>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* 5. MODAL: GOOGLE OAUTH CONFIGURATION STATUS (Informative Architectural Dialog) */}
      {/* ========================================================================= */}
      {showGoogleModal && (
        <div
          className="fixed inset-0 z-50 bg-[#08090B]/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-modal-title"
        >
          <div className="bg-[#17181C] border border-[#D5A34A]/35 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setShowGoogleModal(false)}
              className="absolute right-5 top-5 text-[#94A3B8] hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#24252A] border border-[#D5A34A]/30 flex items-center justify-center">
                <GoogleIcon className="w-5 h-5" />
              </div>
              <h3 id="google-modal-title" className="font-serif text-xl font-bold text-white">
                Google Sign-In Architecture
              </h3>
              <p className="text-xs text-[#CBD5E1]/90 leading-relaxed font-light">
                {googleStatusMsg ||
                  'Google OAuth 2.0 integration is fully supported in the architecture. When the technical lead provisions GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the Hostinger environment variables, customers will be able to sign in seamlessly.'}
              </p>
            </div>

            <div className="bg-[#08090B]/80 border border-[#D5A34A]/20 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[#F5BD48] font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#D5A34A]" />
                <span>Production Environment Requirement</span>
              </div>
              <p className="text-[#94A3B8] leading-relaxed text-[11px]">
                To activate Google authentication, add the following to your Hostinger environment:
              </p>
              <pre className="p-2.5 rounded-lg bg-[#17181C] text-[10.5px] font-mono text-[#CBD5E1] border border-[#D5A34A]/15 overflow-x-auto">
                GOOGLE_CLIENT_ID="your_google_client_id"<br />
                GOOGLE_CLIENT_SECRET="your_google_client_secret"
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                Sign In with Email
              </button>
              <Link
                href="/"
                onClick={() => setShowGoogleModal(false)}
                className="flex-1 h-11 rounded-xl bg-[#24252A] border border-[#D5A34A]/25 text-[#CBD5E1] hover:text-white font-semibold text-xs flex items-center justify-center"
              >
                Browse as Guest
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08090B] flex flex-col items-center justify-center text-[#D5A34A] space-y-3">
          <div className="w-8 h-8 border-2 border-[#D5A34A] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider uppercase text-[#CBD5E1]">
            Loading SNAPPY GIFTZ Atelier...
          </span>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
