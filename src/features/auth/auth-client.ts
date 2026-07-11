import { createAuthClient } from 'better-auth/react';
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
  plugins: [passkeyClient()],
});

export const { signIn, signUp, signOut, useSession, passkey } = authClient;
