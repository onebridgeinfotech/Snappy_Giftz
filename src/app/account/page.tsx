'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Shield,
  Package,
  LogOut,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Building,
  Navigation,
} from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isEmailVerified: boolean;
  createdAt?: string;
}

interface Address {
  id: string;
  name: string;
  company?: string | null;
  street: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
}

type TabType = 'profile' | 'addresses' | 'security' | 'orders';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // Edit Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Addresses State
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    name: '',
    company: '',
    street: '',
    city: '',
    state: 'Telangana',
    stateCode: '36',
    pincode: '',
    phone: '',
    isDefault: false,
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressFeedback, setAddressFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load User on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?redirect=/account');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.authenticated && data.user) {
          setUser(data.user);
          setProfileName(data.user.name || '');
          setProfilePhone(data.user.phone || '');
        } else {
          router.push('/login?redirect=/account');
        }
      })
      .catch(() => {
        router.push('/login?redirect=/account');
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Load addresses when switching to addresses tab
  const fetchAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const res = await fetch('/api/account/addresses');
      const data = await res.json();
      if (res.ok && data.addresses) {
        setAddresses(data.addresses);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'addresses') {
      fetchAddresses();
    }
  }, [activeTab]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileFeedback(null);

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          phone: profilePhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      setUser((prev) => (prev ? { ...prev, name: data.user.name, phone: data.user.phone } : null));
      setProfileFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err.message || 'Error updating profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressSaving(true);
    setAddressFeedback(null);

    try {
      const url = editingAddressId
        ? `/api/account/addresses/${editingAddressId}`
        : '/api/account/addresses';
      const method = editingAddressId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save address.');
      }

      await fetchAddresses();
      setShowAddressModal(false);
      setEditingAddressId(null);
      setAddressForm({
        name: '',
        company: '',
        street: '',
        city: '',
        state: 'Telangana',
        stateCode: '36',
        pincode: '',
        phone: '',
        isDefault: false,
      });
    } catch (err: any) {
      setAddressFeedback({ type: 'error', message: err.message || 'Error saving address.' });
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Are you sure you want to remove this delivery address?')) return;
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // Ignore
    }
  };

  const handleEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      name: addr.name,
      company: addr.company || '',
      street: addr.street,
      city: addr.city,
      state: addr.state,
      stateCode: addr.stateCode,
      pincode: addr.pincode,
      phone: addr.phone,
      isDefault: addr.isDefault,
    });
    setAddressFeedback(null);
    setShowAddressModal(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordFeedback(null);

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
      setPasswordSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setPasswordFeedback({ type: 'success', message: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', message: err.message || 'Error updating password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090B] flex items-center justify-center text-[#D5A34A] text-sm font-semibold">
        <Sparkles className="w-5 h-5 mr-2 animate-spin text-[#F5BD48]" />
        Loading account details...
      </div>
    );
  }

  if (!user) return null;

  const isAdminOrStaff = user.role === 'ADMIN' || user.role === 'STAFF';

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5BD48] to-[#D5A34A] text-[#08090B] flex items-center justify-center font-black text-2xl shadow-lg shadow-[#D5A34A]/20">
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{user.name}</h1>
                {isAdminOrStaff && (
                  <span className="text-[10px] bg-[#D5A34A]/20 border border-[#D5A34A]/40 text-[#F5BD48] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                    {user.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">{user.email}</p>
              {user.phone && <p className="text-[11px] text-[#64748B] mt-0.5">{user.phone}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/"
              className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl border border-[#D5A34A]/30 bg-[#24252A] text-xs font-semibold text-[#CBD5E1] hover:text-[#F5BD48] hover:border-[#D5A34A] transition-all"
            >
              Browse Catalog
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#D5A34A]/20 pb-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#D5A34A] text-[#08090B] shadow-md shadow-[#D5A34A]/20'
                : 'text-[#94A3B8] hover:text-white bg-[#17181C]/50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('addresses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'addresses'
                ? 'bg-[#D5A34A] text-[#08090B] shadow-md shadow-[#D5A34A]/20'
                : 'text-[#94A3B8] hover:text-white bg-[#17181C]/50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Delivery Addresses</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-[#D5A34A] text-[#08090B] shadow-md shadow-[#D5A34A]/20'
                : 'text-[#94A3B8] hover:text-white bg-[#17181C]/50'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security & Password</span>
          </button>

          <Link
            href="/account/orders"
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#F5BD48] hover:text-white bg-[#17181C] border border-[#D5A34A]/30 hover:border-[#D5A34A] transition-all flex items-center gap-2 ml-auto"
          >
            <Package className="w-3.5 h-3.5" />
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Tab 1: Profile & Overview */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Profile Info & Edit */}
            <div className="md:col-span-2 bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#D5A34A]/15">
                <h3 className="text-xs font-bold text-[#D5A34A] uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Personal Details</span>
                </h3>
                {!isEditingProfile && (
                  <button
                    onClick={() => {
                      setIsEditingProfile(true);
                      setProfileFeedback(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-[#F5BD48] hover:underline font-semibold cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>

              {profileFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    profileFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/60 border border-red-500/40 text-red-300'
                  }`}
                >
                  {profileFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span>{profileFeedback.message}</span>
                </div>
              )}

              {!isEditingProfile ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 space-y-1">
                    <span className="text-[#64748B] block text-[11px]">Full Name</span>
                    <span className="text-white font-medium">{user.name}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 space-y-1">
                    <span className="text-[#64748B] block text-[11px]">Email Address</span>
                    <span className="text-white font-medium">{user.email}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 space-y-1">
                    <span className="text-[#64748B] block text-[11px]">Contact Phone</span>
                    <span className="text-white font-medium">{user.phone || 'Not provided'}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 space-y-1">
                    <span className="text-[#64748B] block text-[11px]">Account Type</span>
                    <span className="text-[#F5BD48] font-bold">{user.role}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                      Delivery Contact Mobile
                    </label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full h-10 px-3.5 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer shadow-md shadow-[#D5A34A]/10"
                    >
                      {profileSaving ? 'Saving Changes...' : 'Save Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2.5 rounded-xl bg-[#24252A] text-xs font-semibold text-[#94A3B8] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Quick Orders Summary & Hyderabad Atelier */}
            <div className="space-y-6">
              <div className="bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 space-y-4">
                <h3 className="text-xs font-bold text-[#D5A34A] uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <span>My Orders</span>
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Track live fulfillment status, courier dispatch, download GST tax invoices, or report damages.
                </p>
                <Link
                  href="/account/orders"
                  className="w-full h-10 rounded-xl bg-[#24252A] border border-[#D5A34A]/30 hover:border-[#D5A34A] text-[#F5BD48] text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-[#2e3036]"
                >
                  <span>Open Orders Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 space-y-3">
                <h3 className="text-xs font-bold text-[#D5A34A] uppercase tracking-wider flex items-center gap-2">
                  <Navigation className="w-4 h-4" />
                  <span>Hyderabad Atelier</span>
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Snappy Giftz personal insured express delivery operates within our verified 20km Hyderabad service area.
                </p>
                <div className="p-3 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 text-[11px] text-[#CBD5E1] space-y-1">
                  <div className="font-semibold text-white">Central Atelier:</div>
                  <div>Laxmipuram Rd, A S Rao Nagar, Secunderabad 500062</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Delivery Addresses */}
        {activeTab === 'addresses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D5A34A]/20">
              <div>
                <h2 className="text-lg font-bold text-white">Saved Delivery Addresses</h2>
                <p className="text-xs text-[#94A3B8]">
                  Manage delivery destinations for express courier and gift deliveries.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingAddressId(null);
                  setAddressForm({
                    name: user.name || '',
                    company: '',
                    street: '',
                    city: 'Hyderabad',
                    state: 'Telangana',
                    stateCode: '36',
                    pincode: '',
                    phone: user.phone || '',
                    isDefault: addresses.length === 0,
                  });
                  setAddressFeedback(null);
                  setShowAddressModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center gap-1.5 hover:opacity-95 shadow-md shadow-[#D5A34A]/10 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Address</span>
              </button>
            </div>

            {loadingAddresses ? (
              <div className="p-12 text-center text-xs text-[#D5A34A]">
                Loading delivery addresses...
              </div>
            ) : addresses.length === 0 ? (
              <div className="bg-[#17181C] p-12 rounded-2xl border border-[#D5A34A]/25 text-center space-y-4">
                <MapPin className="w-12 h-12 text-[#D5A34A]/40 mx-auto" />
                <div className="text-sm font-semibold text-white">No Delivery Addresses Saved</div>
                <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                  Add your home or office address to enable 1-click express checkout and delivery tracking.
                </p>
                <button
                  onClick={() => {
                    setEditingAddressId(null);
                    setAddressForm({
                      name: user.name || '',
                      company: '',
                      street: '',
                      city: 'Hyderabad',
                      state: 'Telangana',
                      stateCode: '36',
                      pincode: '',
                      phone: user.phone || '',
                      isDefault: true,
                    });
                    setAddressFeedback(null);
                    setShowAddressModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Address</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`bg-[#17181C] p-5 rounded-2xl border transition-all ${
                      addr.isDefault
                        ? 'border-[#D5A34A] shadow-md shadow-[#D5A34A]/10'
                        : 'border-[#D5A34A]/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{addr.name}</span>
                          {addr.isDefault && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#D5A34A]/20 border border-[#D5A34A]/40 text-[#F5BD48]">
                              Default
                            </span>
                          )}
                        </div>
                        {addr.company && (
                          <div className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-1">
                            <Building className="w-3 h-3 text-[#D5A34A]" />
                            <span>{addr.company}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleEditAddress(addr)}
                          className="p-1.5 rounded-lg bg-[#24252A] text-[#CBD5E1] hover:text-[#F5BD48] hover:bg-[#2e3036] transition-colors"
                          title="Edit Address"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 transition-colors"
                          title="Delete Address"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-[#CBD5E1] space-y-1 border-t border-[#D5A34A]/10 pt-3">
                      <div>{addr.street}</div>
                      <div>
                        {addr.city}, {addr.state} — <span className="font-mono font-bold text-white">{addr.pincode}</span>
                      </div>
                      <div className="text-[11px] text-[#94A3B8] pt-1">
                        Phone: <span className="text-white">{addr.phone}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Address Modal */}
            {showAddressModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-[#17181C] max-w-lg w-full rounded-2xl border border-[#D5A34A]/30 p-6 space-y-5 shadow-2xl animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-[#D5A34A]/20">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#F5BD48]" />
                      <span>{editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address'}</span>
                    </h3>
                    <button
                      onClick={() => setShowAddressModal(false)}
                      className="p-1 text-[#94A3B8] hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {addressFeedback && (
                    <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{addressFeedback.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveAddress} className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                          Recipient Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.name}
                          onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                          placeholder="e.g. Priya Reddy"
                          className="w-full h-9 px-3 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                          Contact Phone *
                        </label>
                        <input
                          type="tel"
                          required
                          value={addressForm.phone}
                          onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                          placeholder="10-digit mobile number"
                          className="w-full h-9 px-3 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                        Company / Apartment Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={addressForm.company}
                        onChange={(e) => setAddressForm({ ...addressForm, company: e.target.value })}
                        placeholder="e.g. Tower 3, Flat 402"
                        className="w-full h-9 px-3 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                        Street Address *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={addressForm.street}
                        onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                        placeholder="House no., street name, landmark"
                        className="w-full p-2.5 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.city}
                          onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                          placeholder="e.g. Hyderabad"
                          className="w-full h-9 px-3 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                          State *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.state}
                          onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                          placeholder="e.g. Telangana"
                          className="w-full h-9 px-3 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                          PIN Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={addressForm.pincode}
                          onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                          placeholder="6-digit PIN"
                          className="w-full h-9 px-3 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-white font-mono placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={addressForm.isDefault}
                        onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                        className="rounded border-[#D5A34A]/40 bg-[#08090B] text-[#D5A34A] focus:ring-[#D5A34A]"
                      />
                      <label htmlFor="isDefault" className="text-xs text-[#CBD5E1] cursor-pointer">
                        Set as default delivery address
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5A34A]/15">
                      <button
                        type="button"
                        onClick={() => setShowAddressModal(false)}
                        className="px-4 py-2 rounded-xl bg-[#24252A] text-xs font-semibold text-[#94A3B8] hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={addressSaving}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs hover:opacity-95 disabled:opacity-50"
                      >
                        {addressSaving ? 'Saving...' : 'Save Address'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Security & Password */}
        {activeTab === 'security' && (
          <div className="bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 max-w-xl space-y-6">
            <div className="pb-3 border-b border-[#D5A34A]/15">
              <h3 className="text-xs font-bold text-[#D5A34A] uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                <span>Change Password</span>
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">
                Protect your account by creating a strong password (minimum 8 characters with letters and numbers).
              </p>
            </div>

            {passwordFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/60 border border-red-500/40 text-red-300'
                }`}
              >
                {passwordFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{passwordFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password (if set)"
                    className="w-full h-10 px-3.5 pr-10 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-3 text-[#94A3B8] hover:text-white"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 letter, 1 number"
                    className="w-full h-10 px-3.5 pr-10 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-[#94A3B8] hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full h-10 px-3.5 pr-10 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-[#94A3B8] hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer shadow-md shadow-[#D5A34A]/10"
                >
                  {passwordSaving ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
