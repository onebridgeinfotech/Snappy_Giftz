'use client';

import React, { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { MainContent } from '@/App';

export default function HomePage() {
  const { mode, setMode } = useApp();

  useEffect(() => {
    // Whenever visiting the homepage storefront, ensure mode is set to 'b2c' so all gifts and products are displayed
    if (mode === 'admin') {
      setMode('b2c');
    }
  }, [mode, setMode]);

  return <MainContent />;
}
