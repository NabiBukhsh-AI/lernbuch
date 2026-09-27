import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * Session guard.
 *
 * Built from the edge-safe config only. It reads the JWT and nothing else, so
 * no database call and no native module is pulled into the edge bundle. Pages
 * and actions re-check the user row (src/lib/session.ts), which is what
 * catches suspended and deleted accounts; admin pages additionally check the
 * role there.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (req.auth) return;

  const { pathname, search } = req.nextUrl;

  // A visitor who is not signed in sees the landing page, not a login wall.
  if (pathname === '/') return Response.redirect(new URL('/welcome', req.nextUrl.origin));

  const target = new URL('/login', req.nextUrl.origin);
  target.searchParams.set('callbackUrl', pathname + search);
  return Response.redirect(target);
});

/**
 * Everything except the public pages, /api/auth/*, and static assets. A path
 * that is not listed here is guarded, so new routes are protected by default
 * rather than needing to be remembered.
 */
export const config = {
  matcher: [
    '/((?!welcome|login|signup|api/auth|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
