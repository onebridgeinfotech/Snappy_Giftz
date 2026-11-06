import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { BUSINESS_CONFIG } from '@/config/business';

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || BUSINESS_CONFIG.website).replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'SNAPPY GIFTZ | Turning Moments Into Memories — Luxury Gifting Studio',
  description: 'Hyderabad’s premier personalized luxury gifting atelier. Handcrafted bespoke gifts, custom laser engraving, signature keepsake packaging, and direct express delivery across Hyderabad.',
  icons: {
    icon: '/assets/snappy-gifts-trimmed.png',
    shortcut: '/assets/snappy-gifts-trimmed.png',
    apple: '/assets/snappy-gifts-trimmed.png',
  },
  openGraph: {
    title: 'SNAPPY GIFTZ | Turning Moments Into Memories — Luxury Gifting Studio',
    description: 'Hyderabad’s premier personalized luxury gifting atelier. Handcrafted bespoke gifts, custom laser engraving, signature keepsake packaging, and direct express delivery across Hyderabad.',
    type: 'website',
    url: siteUrl,
    siteName: BUSINESS_CONFIG.brandName,
    images: [{ url: '/assets/snappy-gifts-trimmed.png', width: 512, height: 512, alt: 'SNAPPY GIFTZ' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/assets/snappy-gifts-trimmed.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Dancing+Script:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning className="bg-[#08090B] text-[#F1F5F9] antialiased selection:bg-[#D5A34A]/30 selection:text-[#F5BD48] font-sans">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
