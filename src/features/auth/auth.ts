import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { passkey } from '@better-auth/passkey';
import { db } from '@/lib/db/client';
import * as authSchema from '@/lib/db/auth-schema';
import { hashPassword, verifyPassword } from './password';

/**
 * The better-auth server instance — the single source of truth for authentication.
 *
 * Passkeys-first (AGENTS.md §6): the passkey plugin is the primary returning-login
 * method; email/password and Google OAuth are account bootstraps. Sessions are stored
 * in the database (not JWTs), and better-auth issues `HttpOnly`, `Secure` (in prod),
 * `SameSite=Lax` cookies by default — no tokens in web storage.
 *
 * Server-only: this module reads OAuth secrets from env and must never reach the client
 * bundle. Everything downstream (the BOLA layer in 4.3.1, leaderboards in 4.4) depends
 * only on `session.userId`, so the auth-library choice stays isolated here.
 */
const appUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
const rpID = new URL(appUrl).hostname; // e.g. "localhost" in dev, the domain in prod

// Register Google only when its credentials exist, so a missing OAuth app doesn't break
// the build or startup — email/password + passkeys still work without it.
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
const socialProviders =
  googleId && googleSecret
    ? { google: { clientId: googleId, clientSecret: googleSecret } }
    : undefined;

export const auth = betterAuth({
  baseURL: appUrl,
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  // Public leaderboard handle — settable via updateUser, returned in the session user.
  // Uniqueness is enforced by the DB constraint (a taken handle surfaces as an error).
  user: {
    additionalFields: {
      username: { type: 'string', required: false, input: true },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Override better-auth's default scrypt with Argon2id (AGENTS.md §6).
    password: { hash: hashPassword, verify: verifyPassword },
  },
  ...(socialProviders ? { socialProviders } : {}),
  plugins: [
    passkey({ rpID, rpName: 'Puzzle Generator', origin: appUrl }),
    nextCookies(), // MUST be last: attaches Set-Cookie via Next's cookies() in server actions.
  ],
});
