import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';

export const metadata: Metadata = {
  title: 'SNAPPY GIFTZ | Premier B2C & B2B Corporate Gifting Platform',
  description: 'Premier B2C and B2B gift e-commerce platform with personalized laser-engraved gifts, corporate bulk gifting, RFQ workflow, inventory, GST invoicing, and recipient distribution.',
  openGraph: {
    title: 'SNAPPY GIFTZ | Premier B2C & B2B Corporate Gifting Platform',
    description: 'Premier B2C and B2B gift e-commerce platform with personalized gifts, corporate bulk gifting, RFQ workflow, inventory, GST invoicing, and recipient distribution.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Dancing+Script:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#08090B] text-[#F1F5F9] antialiased selection:bg-[#D5A34A]/30 selection:text-[#F5BD48] font-sans">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
