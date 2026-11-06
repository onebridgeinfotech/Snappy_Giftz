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
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

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

      setSuccessMessage(`A 6-digit verification code has been dispatched to ${cleanEmail}.`);
      setStep('reset');
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Password reset is temporarily unavailable while the database and SMTP service are pending configuration.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setIsLoading(true);
    setErrorMessage(null);

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

      setSuccessMessage('A fresh 6-digit verification code has been dispatched.');
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the valid 6-digit verification code.');
      return;
    }

    if (!newPassword) {
      setErrorMessage('Please enter your new password.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setErrorMessage('Password must contain at least one letter and one number.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanOtp,
          newPassword,
          confirmPassword,
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

      setStep('success');
      setSuccessMessage(data.message || 'Your password has been successfully updated.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] flex flex-col justify-between selection:bg-[#D5A34A] selection:text-[#08090B]">
      {/* Top Header */}
      <nav className="w-full border-b border-[#D5A34A]/15 bg-[#08090B]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3.5 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#CBD5E1] hover:text-[#F5BD48] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#D5A34A] group-hover:-translate-x-1 transition-transform" />
            <span>Return to Sign In</span>
          </Link>

          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <ShieldCheck className="w-4 h-4 text-[#D5A34A]" />
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-12 sm:py-16 flex items-center justify-center">
        <div className="w-full bg-[#17181C] border border-[#D5A34A]/30 rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] space-y-6">
          {/* Brand & Title */}
          <div className="text-center space-y-3">
            <Link href="/" className="inline-block group focus:outline-hidden" title="SNAPPY GIFTZ Home">
              <img
                src="/brand/snappy-giftz-logo.png"
                alt="SNAPPY GIFTZ - Turning Moments Into Memories"
                className="h-10 sm:h-12 w-auto mx-auto object-contain brightness-105"
              />
            </Link>
            <div>
              <h1 className="font-serif text-2xl font-bold text-white tracking-wide">
                {step === 'request' && 'Reset Your Password'}
                {step === 'reset' && 'Create New Password'}
                {step === 'success' && 'Password Reset Complete'}
              </h1>
              <p className="text-xs text-[#94A3B8] font-light mt-1">
                {step === 'request' && 'Enter your registered email address to receive a 6-digit verification code.'}
                {step === 'reset' && 'Enter the verification code sent to your email and choose a strong new password.'}
                {step === 'success' && 'Your password has been updated securely. All previous active sessions have been revoked.'}
              </p>
            </div>
          </div>

          {/* Alert Messages */}
          {successMessage && step !== 'success' && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Request OTP */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#94A3B8]" />
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={isLoading}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:border-[#D5A34A] focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-[#08090B] border-t-transparent rounded-full animate-spin" />
                    <span>Sending Code...</span>
                  </div>
                ) : (
                  <span>Send Verification Code</span>
                )}
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-[#CBD5E1] hover:text-[#F5BD48] transition-colors">
                  Remember your password? <span className="text-[#F5BD48] font-semibold underline">Sign In</span>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Enter Code + Set New Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#08090B] border border-[#D5A34A]/20 text-xs">
                <div className="flex items-center gap-2 text-[#CBD5E1] truncate">
                  <Mail className="w-3.5 h-3.5 text-[#D5A34A] shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setErrorMessage(null);
                  }}
                  className="text-[#F5BD48] hover:underline font-semibold text-[11px] shrink-0 ml-2 cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="reset-otp" className="block text-xs font-semibold text-[#CBD5E1]">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={handleResendOtp}
                    className="text-[11px] text-[#F5BD48] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  disabled={isLoading}
                  className="w-full h-11 px-4 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-center font-mono text-base tracking-[0.3em] text-[#F5BD48] placeholder-[#64748B] focus:border-[#F5BD48] focus:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="reset-new-password" className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#94A3B8]" />
                  <input
                    id="reset-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    disabled={isLoading}
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:border-[#D5A34A] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-3.5 text-[#94A3B8] hover:text-[#CBD5E1] cursor-pointer"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#94A3B8]" />
                  <input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    disabled={isLoading}
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:border-[#D5A34A] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3.5 text-[#94A3B8] hover:text-[#CBD5E1] cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Policy Helpers */}
              <div className="p-2.5 rounded-xl bg-[#08090B]/60 border border-[#D5A34A]/15 space-y-1 text-[11px] text-[#94A3B8]">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${newPassword.length >= 8 ? 'bg-emerald-400' : 'bg-[#64748B]'}`} />
                  <span className={newPassword.length >= 8 ? 'text-emerald-300' : ''}>At least 8 characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${/[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'bg-emerald-400' : 'bg-[#64748B]'}`} />
                  <span className={/[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'text-emerald-300' : ''}>At least one letter and one number</span>
                </div>
                {confirmPassword && (
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${newPassword === confirmPassword ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span className={newPassword === confirmPassword ? 'text-emerald-300' : 'text-rose-300'}>
                      {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6 || newPassword.length < 8 || newPassword !== confirmPassword}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
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
          {step === 'success' && (
            <div className="space-y-4 text-center py-2">
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs text-left leading-relaxed">
                {successMessage || 'Your password has been successfully updated.'} All previous active sessions on other browsers have been invalidated.
              </div>

              <Link
                href="/login"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          <div className="pt-3 border-t border-[#D5A34A]/15 text-center text-xs text-[#94A3B8]">
            Need direct help? Contact our Concierge at{' '}
            <a href={`mailto:${BUSINESS_CONFIG.officialEmail}`} className="text-[#F5BD48] underline">
              {BUSINESS_CONFIG.officialEmail}
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#D5A34A]/15 bg-[#08090B]/90 py-4 px-4 text-center text-xs text-[#94A3B8]">
        &copy; {new Date().getFullYear()} {BUSINESS_CONFIG.brandName}. All rights reserved.
      </footer>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08090B] flex flex-col items-center justify-center text-[#D5A34A] space-y-3">
          <div className="w-8 h-8 border-2 border-[#D5A34A] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider uppercase text-[#CBD5E1]">
            Loading Security Portal...
          </span>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
