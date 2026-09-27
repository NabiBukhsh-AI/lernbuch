import type { MetadataRoute } from 'next';

/** The landing page is public; everything else sits behind a login. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/welcome', disallow: '/' },
  };
}
