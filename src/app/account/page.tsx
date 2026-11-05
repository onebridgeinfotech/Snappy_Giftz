'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Shield, Package, LogOut, Sparkles, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import { PasskeyManager } from '@/components/account/PasskeyManager';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          router.push('/login?redirect=/account');
        }
      })
      .catch(() => {
        router.push('/login?redirect=/account');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090B] flex items-center justify-center text-[#D5A34A] text-sm font-semibold">
        Loading account details...
      </div>
    );
  }

  if (!user) return null;

  const isAdminOrStaff = user.role === 'ADMIN' || user.role === 'STAFF';

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#D5A34A]/25">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5BD48] to-[#D5A34A] text-[#08090B] flex items-center justify-center font-black text-xl shadow-lg shadow-[#D5A34A]/20">
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <span>{user.name}</span>
                {isAdminOrStaff && (
                  <span className="text-[10px] bg-[#D5A34A]/20 border border-[#D5A34A]/40 text-[#F5BD48] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                    {user.role}
                  </span>
                )}
              </h1>
              <p className="text-xs text-[#94A3B8]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/"
              className="flex-1 sm:flex-none text-center px-4 py-2 rounded-xl border border-[#D5A34A]/30 bg-[#17181C] text-xs font-semibold text-[#CBD5E1] hover:text-[#F5BD48] hover:border-[#D5A34A] transition-all"
            >
              Browse Catalog
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Profile Card */}
          <div className="bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 space-y-4">
            <h3 className="text-xs font-bold text-[#D5A34A] uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Profile Information</span>
            </h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#64748B] block text-[11px]">Full Name</span>
                <span className="text-white font-medium">{user.name}</span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[11px]">Email Address</span>
                <span className="text-white font-medium">{user.email}</span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[11px]">Account Role</span>
                <span className="text-white font-medium">{user.role}</span>
              </div>
            </div>
          </div>

          {/* Quick Orders Card */}
          <div className="bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold text-[#D5A34A] uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>My Orders</span>
              </h3>
              <p className="mt-2 text-xs text-[#94A3B8]">
                View placed orders, track courier status, download tax invoices, and report product damages within 24 hours.
              </p>
            </div>

            <Link
              href="/account/orders"
              className="w-full h-10 rounded-xl bg-[#24252A] border border-[#D5A34A]/30 hover:border-[#D5A34A] text-[#F5BD48] text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-[#2e3036]"
            >
              <span>View Order History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Service Area Card */}
          <div className="bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 space-y-4">
            <h3 className="text-xs font-bold text-[#D5A34A] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Hyderabad Service Area</span>
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Snappy Giftz personal insured express deliveries operate within our verified 20km Hyderabad service area.
            </p>
            <div className="p-3 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 text-[11px] text-[#CBD5E1] space-y-1">
              <div className="font-semibold text-white">Central Atelier:</div>
              <div>Laxmipuram Rd, A S Rao Nagar, Secunderabad 500062</div>
            </div>
          </div>

        </div>

        <PasskeyManager />

      </div>
    </div>
  );
}

