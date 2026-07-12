import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

/**
 * The browser-side better-auth client — the client counterpart to the server `auth`
 * instance. Talks to `/api/auth/*` on the same origin (so no `baseURL` is needed), and
 * carries the passkey plugin so `signIn.passkey()` / `passkey.addPasskey()` are available.
 *
 * Safe to import from Client Components only (it uses browser APIs). It holds no secrets —
 * OAuth/session secrets live server-side; this just calls the endpoints.
 */
export const authClient = createAuthClient({
  // inferAdditionalFields teaches the client about our server-side `username` field (object
  // form so we don't import the server-only `auth` instance) — so updateUser({ username })
  // and session.user.username are typed.
  plugins: [passkeyClient(), inferAdditionalFields({ user: { username: { type: 'string', required: false } } })],
});

export const { signIn, signUp, signOut, useSession, passkey, updateUser } = authClient;

/** The session user, augmented with our `username` additional field (not in the base type). */
export type SessionUser = { id: string; name: string; email: string; username?: string | null };
