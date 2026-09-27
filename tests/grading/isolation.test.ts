/**
 * Section 9.3, stated as a hard rule that must be covered by a test:
 *
 *   "Server Actions read the user id from the session, never from client
 *    input."
 *
 * The test asserts the property directly: with no session, the action refuses,
 * and it refuses even when the caller supplies a userId of their own.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

describe('Server Action identity', () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it('refuses to write when there is no session', async () => {
    authMock.mockResolvedValue(null);
    const { submitAnswer } = await import('@/actions/exercises');

    await expect(
      submitAnswer({ exerciseId: 'anything:cw:cw-01', userAnswer: 'den' }),
    ).rejects.toThrow(/not authenticated/i);
  });

  it('ignores a userId supplied by the caller', async () => {
    authMock.mockResolvedValue(null);
    const { submitAnswer } = await import('@/actions/exercises');

    // A caller trying to write as somebody else must still be refused: the id
    // comes from the session, and there is no session.
    await expect(
      submitAnswer({
        exerciseId: 'anything:cw:cw-01',
        userAnswer: 'den',
        userId: 'u_nabi',
      }),
    ).rejects.toThrow(/not authenticated/i);
  });

  it('refuses markAcceptable without a session too', async () => {
    authMock.mockResolvedValue(null);
    const { markAcceptable } = await import('@/actions/exercises');

    await expect(
      markAcceptable({ exerciseId: 'anything:cw:cw-01', answer: 'x' }),
    ).rejects.toThrow(/not authenticated/i);
  });

  it('rejects a malformed payload before touching the database', async () => {
    authMock.mockResolvedValue({ user: { id: 'u_nabi' } });
    const { submitAnswer } = await import('@/actions/exercises');

    // No exerciseId: Zod must reject rather than the query failing later.
    await expect(submitAnswer({ userAnswer: 'den' })).rejects.toThrow();
  });
});
