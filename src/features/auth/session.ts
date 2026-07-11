import 'server-only';
import { headers } from 'next/headers';
import { auth } from './auth';

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
