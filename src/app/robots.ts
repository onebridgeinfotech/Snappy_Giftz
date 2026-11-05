import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://snappygiftz.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/products/'],
        disallow: [
          '/api/admin/',
          '/api/auth/',
          '/api/b2b/',
          '/*?*admin=*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
