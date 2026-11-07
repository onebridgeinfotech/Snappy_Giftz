'use client';

import React from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

/**
 * Admin portal. The dashboard renders its own shell (dark sidebar + top bar),
 * so the storefront header and footer are not used here.
 */
export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] selection:bg-[#D5A34A]/30 selection:text-[#F5BD48]">
      <AdminDashboard />
    </div>
  );
}
