import type { MetadataRoute } from 'next';
import { BUSINESS_CONFIG } from '@/config/business';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BUSINESS_CONFIG.brandName,
    short_name: 'Snappy Giftz',
    description:
      'Hyderabad personalized luxury gifting — custom engraving, signature packaging, and express local delivery.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#08090B',
    theme_color: '#08090B',
    categories: ['shopping', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
