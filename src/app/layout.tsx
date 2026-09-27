import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google';
import { APP_NAME } from '@/lib/utils';
import './globals.css';

/* Section 16.3 */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const DESCRIPTION =
  'German that shows you how it works: colour-coded genders, visible cases, the Satzklammer, exercises that explain every answer, and spaced repetition. Free, A1 to B1.';

/*
 * metadataBase is left to Next.js, which uses the Vercel production domain
 * (or localhost in development) to make the share image URL absolute.
 */
export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  category: 'education',
  keywords: [
    'learn German',
    'German grammar',
    'German vocabulary',
    'der die das',
    'German articles',
    'Akkusativ',
    'Dativ',
    'Satzklammer',
    'A1',
    'A2',
    'B1',
    'spaced repetition',
  ],
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    locale: 'en',
    title: `${APP_NAME} · German that shows you how it works`,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} · German that shows you how it works`,
    description: DESCRIPTION,
  },
  // Only the landing page opts in to indexing; everything else is behind a login.
  robots: { index: false, follow: false },
};

/** Tints the mobile browser bar to match the page in either theme. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f3f1' },
    { media: '(prefers-color-scheme: dark)', color: '#14181a' },
  ],
};

/**
 * Applies a saved theme before first paint, so a dark-mode choice does not
 * flash light on every load. `system` is the absence of a saved value.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${bricolage.variable} ${sourceSerif.variable} ${plexMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
