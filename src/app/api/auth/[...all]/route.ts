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

export const { GET, POST } = toNextJsHandler(auth);
