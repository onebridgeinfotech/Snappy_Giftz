import type { Metadata } from 'next';
import React from 'react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `Sign In | ${BUSINESS_CONFIG.brandName} — Luxury Gifting Atelier`,
  description: `Sign in to your ${BUSINESS_CONFIG.brandName} account to manage personalized keepsake orders, preview 24K gold foil engravings, and track insured Hyderabad deliveries.`,
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

