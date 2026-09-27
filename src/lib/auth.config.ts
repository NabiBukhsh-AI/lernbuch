import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe half of the Auth.js configuration — Section 9.2.
 *
 * This module is imported by `src/middleware.ts`, which runs on the edge
 * runtime. It must therefore never reach the database or the Argon2 native
 * module. The Credentials provider that needs both lives in `src/lib/auth.ts`
 * and is only loaded by the Node-runtime route handler and Server Actions.
 */
export const authConfig = {
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  // Populated in src/lib/auth.ts. Middleware only needs to read the JWT.
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.username = user.username;
        token.displayName = user.displayName;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.displayName = token.displayName;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
