import type { DefaultSession } from 'next-auth';

type AppRole = 'admin' | 'learner';

declare module 'next-auth' {
  interface User {
    username: string;
    displayName: string;
    role: AppRole;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string;
      role: AppRole;
    } & DefaultSession['user'];
  }
}

/**
 * The JWT interface lives in `@auth/core/jwt`; `next-auth/jwt` only re-exports
 * it. Augmenting the re-export declares a second, unrelated interface and the
 * claims still read as `unknown`, so the augmentation has to name the module
 * the type actually comes from. `@auth/core` is a direct devDependency purely
 * so that this specifier resolves under pnpm's strict node_modules layout.
 */
declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    username: string;
    displayName: string;
    role: AppRole;
  }
}

export {};
