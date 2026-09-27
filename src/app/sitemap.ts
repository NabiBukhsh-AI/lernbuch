import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/utils';

/** Only the landing page is public, so it is the whole sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/welcome`, changeFrequency: 'weekly', priority: 1 }];
}
