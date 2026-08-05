import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { passkey } from '@better-auth/passkey';
import { db } from '@/lib/db/client';
import * as authSchema from '@/lib/db/auth-schema';
import { hashPassword, verifyPassword } from './password';
import { upstashRateLimitStorage } from './rate-limit-storage';
import { usernameSchema } from './username-schema';

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
// rpID defaults to the app URL's hostname, but can be pinned to the apex ahead of
// the multi-zone migration so passkeys survive the move to biscuitlab.net/puzzles.
// A credential is bound to its rpID; see Docs/multi-zone-migration-plan.md §1-2.
const rpID = process.env.PASSKEY_RP_ID ?? new URL(appUrl).hostname;
// The public scheme+host, with any path stripped — used as both the WebAuthn `origin`
// (which is scheme+host only) and better-auth's `baseURL`. Deriving the origin (rather
// than passing `appUrl` verbatim) is load-bearing for the multi-zone setup: under
// `basePath: '/puzzles'`, Next strips `/puzzles` before the route handler, so better-auth
// receives requests at `/api/auth/*` and its router must match there. better-auth sets its
// router base from `new URL(baseURL).pathname`, so a `baseURL` carrying `/puzzles` (as the
// env once did) mounts the router at `/puzzles` and every endpoint 404s. An origin-only
// `baseURL` mounts it at the default `/api/auth`, matching what the handler actually gets —
// and stays correct even if `BETTER_AUTH_URL` is misconfigured back to carrying a path.
// See Docs/multi-zone-migration-plan.md and the hub's Docs/multi-zone-cutover-log.md.
const publicOrigin = new URL(appUrl).origin;

// Register Google only when its credentials exist, so a missing OAuth app doesn't break
// the build or startup — email/password + passkeys still work without it.
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
// The OAuth callback is the one absolute URL better-auth builds server-side that the
// origin-only `baseURL` gets wrong: it would derive `${publicOrigin}/api/auth/callback/google`
// (no `/puzzles`), which the hub's `/puzzles/*` rewrite doesn't cover and Google can't reach.
// Pin it explicitly to the public, `/puzzles`-prefixed path the browser and Google actually
// use (the mirror of the client's `basePath: '/puzzles/api/auth'`); the hub rewrites it to the
// origin and Next strips `/puzzles` back off before the handler. This value must also be
// whitelisted as an Authorized redirect URI in the Google Cloud console.
const googleRedirectURI = `${publicOrigin}/puzzles/api/auth/callback/google`;
const socialProviders =
  googleId && googleSecret
    ? {
        google: {
          clientId: googleId,
          clientSecret: googleSecret,
          redirectURI: googleRedirectURI,
        },
      }
    : undefined;

// Trusted origins for better-auth's Origin/CSRF check. The production origin (BETTER_AUTH_URL) is
// trusted automatically. Vercel preview deployments are served from a unique per-deployment
// subdomain that `baseURL` can't know ahead of time, so their origin check would reject every
// preview without help. We add THIS deployment's own Vercel origins (from Vercel's system env vars)
// rather than a `https://*.vercel.app` wildcard — the wildcard trusted every Vercel customer's app,
// not just this project's previews (an over-broad CSRF trust surface; AGENTS.md §6 says scope preview
// trust narrowly). `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated) is an explicit escape hatch for any
// additional origin (e.g. a custom preview domain) without reintroducing a wildcard.
const vercelPreviewOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);
const explicitTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const trustedOrigins = [...new Set([...vercelPreviewOrigins, ...explicitTrustedOrigins])];

export const auth = betterAuth({
  baseURL: publicOrigin,
  trustedOrigins,
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  // Rate-limit storage: shared across Vercel's separate serverless instances via Upstash
  // when configured, instead of the library's default in-memory counters (which don't
  // survive a cold start or coordinate across instances). Scoped to `rateLimit.customStorage`
  // rather than the top-level `secondaryStorage` option deliberately — see rate-limit-
  // storage.md for why. Falls back to in-memory when Upstash env vars are unset (e.g. local
  // dev) — same conditional pattern as Google below.
  ...(upstashRateLimitStorage ? { rateLimit: { customStorage: upstashRateLimitStorage } } : {}),
  // Public leaderboard handle — settable via updateUser, returned in the session user.
  // Uniqueness is enforced by the DB constraint (a taken handle surfaces as an error).
  //
  // `validator.input` is REQUIRED, not decorative: without it better-auth assigns the field
  // verbatim (`parsedData[key] = data[key]` in its `parseInputData`), so the 3–20 char rule
  // enforced in the UI was the ONLY check — and a direct `POST /api/auth/update-user` sailed
  // past it into an unbounded `text` column that renders on the public leaderboard. The schema
  // must be synchronous: better-auth throws INTERNAL_SERVER_ERROR on a Promise-returning
  // validator. A rejection surfaces as a 400 carrying `issues[0].message`, which is why the
  // message is the shared `USERNAME_RULE` string the client shows.
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
        input: true,
        validator: { input: usernameSchema },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Override better-auth's default scrypt with Argon2id (AGENTS.md §6).
    password: { hash: hashPassword, verify: verifyPassword },
  },
  ...(socialProviders ? { socialProviders } : {}),
  plugins: [
    passkey({ rpID, rpName: 'Puzzle Generator', origin: publicOrigin }),
    nextCookies(), // MUST be last: attaches Set-Cookie via Next's cookies() in server actions.
  ],
});
