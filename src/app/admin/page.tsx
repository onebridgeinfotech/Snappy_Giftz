'use client';

import React, { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function AdminPage() {
  const { mode, setMode, currentRole, setCurrentRole } = useApp();

  useEffect(() => {
    if (mode !== 'admin') {
      setMode('admin');
    }
    if (currentRole !== 'admin') {
      setCurrentRole('admin');
    }
  }, [mode, setMode, currentRole, setCurrentRole]);

  return (
    <div className="min-h-screen flex flex-col bg-[#08090B] text-[#F1F5F9] selection:bg-[#D5A34A]/30 selection:text-[#F5BD48]">
      <Header />
      <main className="flex-1">
        <AdminDashboard />
      </main>
      <Footer />
    </div>
  );
}

