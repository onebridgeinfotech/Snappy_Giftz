'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Eye,
  EyeOff,
  Crown,
  Sparkles,
  Package
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'login' | 'otp' | 'register'>('login');
  const [loginView, setLoginView] = useState<'signin' | 'forgot' | 'reset'>('signin');
  const [newPassword, setNewPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [accountType, setAccountType] = useState<'CUSTOMER' | 'B2B_CLIENT'>('CUSTOMER');
  
  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      fetch('/api/auth/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
          } else {
            setCurrentUser(null);
          }
        })
        .catch(() => setCurrentUser(null));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send reset code.');
      setSuccessMsg(data.message || 'Check your email for a reset code.');
      setLoginView('reset');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset password.');
      setSuccessMsg(data.message || 'Password updated. You can sign in now.');
      setPassword(newPassword);
      setNewPassword('');
      setOtpCode('');
      setLoginView('signin');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in.');
      }

      setCurrentUser(data.user);
      setSuccessMsg('Successfully signed in! Welcome back.');
      if (onAuthSuccess) onAuthSuccess(data.user);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone, role: accountType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account.');
      }

      setCurrentUser(data.user);
      setSuccessMsg('Account created successfully! Welcome to Snappy Gifts.');
      if (onAuthSuccess) onAuthSuccess(data.user);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'LOGIN' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP.');
      }

      setOtpSent(true);
      setSuccessMsg(data.message || 'Verification code sent to your email.');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode, purpose: 'LOGIN' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify code.');
      }

      setCurrentUser(data.user);
      setSuccessMsg('Code verified! You are now logged in.');
      if (onAuthSuccess) onAuthSuccess(data.user);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setSuccessMsg('You have been logged out.');
      setTimeout(() => onClose(), 1000);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-[#08090B] rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-[#D5A34A]/30 overflow-hidden my-6">
        
        {/* Header - Refined Dark Luxury */}
        <div className="bg-[#17181C] text-white p-6 relative border-b border-[#D5A34A]/20">
          <button
            onClick={onClose}
            aria-label="Close authentication modal"
            className="absolute top-5 right-5 p-1.5 rounded-full text-[#CBD5E1] hover:text-[#F5BD48] hover:bg-[#24252A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F5BD48] animate-pulse" />
            <span className="text-[10px] font-bold text-[#D5A34A] uppercase tracking-widest font-mono flex items-center gap-1">
              <Crown className="w-3 h-3 text-[#F5BD48]" />
              SECURE ACCESS
            </span>
          </div>
          <h3 id="auth-modal-title" className="font-serif text-2xl font-bold tracking-tight text-white">
            {currentUser ? 'Your Snappy Account' : 'Welcome to Snappy Gifts'}
          </h3>
          <p className="text-xs text-[#CBD5E1] mt-1 font-light leading-relaxed">
            {currentUser 
              ? 'Manage your active session and role permissions.' 
              : 'Sign in to access corporate orders, order tracking, and bespoke personalization.'}
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div role="alert" className="m-4 mb-0 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div role="alert" className="m-4 mb-0 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6">
          {currentUser ? (
            /* Logged-In Account Info */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#17181C] border border-[#D5A34A]/20 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94A3B8] font-medium">Name:</span>
                  <span className="font-bold text-[#F1F5F9]">{currentUser.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94A3B8] font-medium">Email:</span>
                  <span className="font-mono text-[#CBD5E1]">{currentUser.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94A3B8] font-medium">Assigned Role:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D5A34A]/20 text-[#F5BD48] border border-[#D5A34A]/40 uppercase tracking-wider font-mono">
                    {currentUser.role}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94A3B8] font-medium">Email Status:</span>
                  <span className={`text-[11px] font-semibold flex items-center gap-1 ${currentUser.isEmailVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {currentUser.isEmailVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <a
                  href="/account"
                  onClick={() => onClose()}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>My Account</span>
                </a>
                <a
                  href="/account/orders"
                  onClick={() => onClose()}
                  className="py-2.5 rounded-xl bg-[#24252A] hover:bg-[#2D2F35] border border-[#D5A34A]/40 text-[#F5BD48] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Order History</span>
                </a>
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-[#24252A] hover:bg-[#2D2F35] border border-[#D5A34A]/30 text-[#CBD5E1] hover:text-[#F5BD48] text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isLoading ? 'Signing out...' : 'Sign Out of Snappy Gifts'}</span>
              </button>
            </div>
          ) : (
            /* Guest Auth Tabs */
            <div>
              {/* Tab Navigation */}
              <div className="flex border-b border-[#D5A34A]/20 mb-5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setLoginView('signin'); setErrorMsg(null); }}
                  className={`flex-1 pb-2.5 text-center transition-all cursor-pointer ${
                    tab === 'login'
                      ? 'border-b-2 border-[#D5A34A] text-[#F5BD48] font-bold'
                      : 'text-[#94A3B8] hover:text-[#CBD5E1]'
                  }`}
                >
                  Password Login
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('otp'); setErrorMsg(null); }}
                  className={`flex-1 pb-2.5 text-center transition-all cursor-pointer ${
                    tab === 'otp'
                      ? 'border-b-2 border-[#D5A34A] text-[#F5BD48] font-bold'
                      : 'text-[#94A3B8] hover:text-[#CBD5E1]'
                  }`}
                >
                  Email OTP
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('register'); setErrorMsg(null); }}
                  className={`flex-1 pb-2.5 text-center transition-all cursor-pointer ${
                    tab === 'register'
                      ? 'border-b-2 border-[#D5A34A] text-[#F5BD48] font-bold'
                      : 'text-[#94A3B8] hover:text-[#CBD5E1]'
                  }`}
                >
                  Register
                </button>
              </div>

              {/* Tab 1: Password Login */}
              {tab === 'login' && loginView === 'signin' && (
                <form onSubmit={handlePasswordLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => { setLoginView('forgot'); setErrorMsg(null); setSuccessMsg(null); }}
                        className="text-[11px] text-[#D5A34A] hover:text-[#F5BD48] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#F5BD48] transition-colors p-0.5"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] text-xs font-bold hover:brightness-105 shadow-[0_2px_14px_rgba(213,163,74,0.3)] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <span>{isLoading ? 'Authenticating...' : 'Sign In Securely'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {tab === 'login' && loginView === 'forgot' && (
                <form onSubmit={handleForgotPassword} className="space-y-3.5">
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Enter your account email. We will send a 6-digit code to reset your password.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] text-xs font-bold hover:brightness-105 transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Sending...' : 'Send reset code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginView('signin')}
                    className="w-full text-xs text-[#D5A34A] hover:text-[#F5BD48]"
                  >
                    Back to sign in
                  </button>
                </form>
              )}

              {tab === 'login' && loginView === 'reset' && (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Enter the code from your email and choose a new password.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                      6-Digit Code
                    </label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] tracking-[0.35em] text-center font-mono focus:border-[#D5A34A] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] focus:border-[#D5A34A] outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] text-xs font-bold hover:brightness-105 transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Updating...' : 'Update password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginView('forgot')}
                    className="w-full text-xs text-[#D5A34A] hover:text-[#F5BD48]"
                  >
                    Resend code
                  </button>
                </form>
              )}

              {/* Tab 2: OTP Login */}
              {tab === 'otp' && (
                <div className="space-y-3.5">
                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                          Email Address for Code
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden transition-all"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] text-xs font-bold hover:brightness-105 shadow-[0_2px_14px_rgba(213,163,74,0.3)] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{isLoading ? 'Sending...' : 'Send 6-Digit Code'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider">
                            Enter 6-Digit Code
                          </label>
                          <button
                            type="button"
                            onClick={() => setOtpSent(false)}
                            className="text-[11px] text-[#D5A34A] hover:text-[#F5BD48] hover:underline"
                          >
                            Change Email
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          className="w-full tracking-[8px] text-center font-mono font-bold text-lg py-2.5 rounded-xl border border-[#D5A34A]/30 bg-[#24252A] text-white focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] text-xs font-bold hover:brightness-105 shadow-[0_2px_14px_rgba(213,163,74,0.3)] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{isLoading ? 'Verifying...' : 'Verify & Sign In'}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Tab 3: Register */}
              {tab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                      Password (min 8 chars, 1 letter, 1 number)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-2 text-[#94A3B8] hover:text-[#F5BD48] transition-colors p-0.5"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1">
                      Account Type
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setAccountType('CUSTOMER')}
                        className={`p-2 rounded-xl border text-center font-medium transition-all cursor-pointer ${
                          accountType === 'CUSTOMER'
                            ? 'border-[#D5A34A] bg-[#D5A34A]/20 text-[#F5BD48] font-bold shadow-xs'
                            : 'border-[#D5A34A]/20 bg-[#17181C] text-[#CBD5E1] hover:border-[#D5A34A]/50'
                        }`}
                      >
                        Individual (B2C)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType('B2B_CLIENT')}
                        className={`p-2 rounded-xl border text-center font-medium transition-all cursor-pointer ${
                          accountType === 'B2B_CLIENT'
                            ? 'border-[#D5A34A] bg-[#D5A34A]/20 text-[#F5BD48] font-bold shadow-xs'
                            : 'border-[#D5A34A]/20 bg-[#17181C] text-[#CBD5E1] hover:border-[#D5A34A]/50'
                        }`}
                      >
                        Corporate (B2B)
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] text-xs font-bold hover:brightness-105 shadow-[0_2px_14px_rgba(213,163,74,0.3)] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};
