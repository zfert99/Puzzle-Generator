import 'server-only';
import { headers } from 'next/headers';
import { auth } from './auth';
import { UnauthorizedError } from './errors';

/**
 * Server-side session accessor. The single place the app asks "who is the current user?"
 *
 * Everything that needs identity — Server Components, route handlers, and especially the
 * 4.3.1 ownership (BOLA) checks and 4.4 solve submission — calls this and then filters by
 * `session.user.id`. Centralizing it means no route hand-rolls header parsing, and the
 * auth-library specifics stay behind this one function.
 *
 * `headers()` is async in Next 16, so it is awaited before being handed to better-auth.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Convenience: the current user's id, or null if signed out. Basis for ownership checks. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}

/**
 * The current user's id, or throw `UnauthorizedError` (→ 401) if signed out.
 *
 * This is the BOLA (4.3.1) entry point: a protected route calls `requireUserId()` and
 * then passes the returned id — the SERVER's notion of "who is calling" — into the data
 * layer. A route must never take a `userId` from the request body/query; ownership is
 * always derived here so a caller can never act as another user.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new UnauthorizedError();
  return userId;
}
