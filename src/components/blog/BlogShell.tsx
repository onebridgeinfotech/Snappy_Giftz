import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export function BlogShell({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#08090B] text-[#F1F5F9]">
      <Header />
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 ${narrow ? 'max-w-3xl' : 'max-w-7xl'}`}>{children}</main>
      <Footer />
    </div>
  );
}
