/**
 * Auth error types. Kept in their own module (no `server-only`, no imports) so both the
 * server-only session guard and thin route controllers — and their tests — can share
 * them without pulling in the better-auth instance.
 */

/** Thrown by `requireUserId()` when there is no authenticated session. Routes map it to 401. */
export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
