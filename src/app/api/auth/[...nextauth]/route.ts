import { handlers } from '@/lib/auth';

/** Argon2 is a native module and the credentials check hits Neon. */
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
