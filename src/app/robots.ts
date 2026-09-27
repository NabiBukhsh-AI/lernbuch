import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/utils';

/** The landing page is public; everything else sits behind a login. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/welcome', disallow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
