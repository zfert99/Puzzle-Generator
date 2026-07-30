import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/features/auth/auth';

/**
 * better-auth's catch-all handler — mounts every auth endpoint under `/api/auth/*`
 * (sign-up, sign-in, sign-out, session, OAuth callbacks, passkey register/authenticate).
 *
 * Thin by design (AGENTS.md §1): all logic lives in the `auth` instance; this file only
 * adapts it to Next's route-handler contract. Runs on the Node.js runtime because the
 * Argon2id hasher (`@node-rs/argon2`) and the DB driver are Node-native, never Edge.
 */
export const runtime = 'nodejs';

const handlers = toNextJsHandler(auth);

/**
 * TEMP diagnostic (multi-zone basePath test) — removed in the auth-fix PR.
 * `GET .../api/auth/get-session?__pathcheck=1` returns the URL/pathname this handler
 * actually receives, to determine whether Next 16 strips the `/puzzles` basePath
 * before better-auth sees it (which decides the correct server `basePath`). See
 * Docs/multi-zone-cutover-log.md.
 */
export const GET = (request: Request) => {
  const url = new URL(request.url);
  if (url.searchParams.has('__pathcheck')) {
    return Response.json({ url: request.url, pathname: url.pathname });
  }
  return handlers.GET(request);
};

export const POST = handlers.POST;
