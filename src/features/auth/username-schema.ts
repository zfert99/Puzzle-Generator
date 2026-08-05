import { z } from 'zod';
import { USERNAME_PATTERN, USERNAME_RULE } from './username';

/**
 * The server-side username validator, wired into better-auth as
 * `user.additionalFields.username.validator.input` (see `auth.ts`).
 *
 * **Why this is a separate module from `username.ts`.** The pattern itself is imported by
 * `'use client'` components, and building the schema alongside it would pull Zod into the
 * client bundle for two components that need nothing but a regex. Splitting also makes the
 * control directly unit-testable: `auth.ts` imports `server-only` and the Neon client, so a
 * test could not reach the schema through it without standing up the whole auth instance.
 *
 * **Why Zod rather than a hand-rolled Standard Schema object.** better-auth calls
 * `validator.input['~standard'].validate(value)` and requires the result to be
 * *synchronous* — it throws INTERNAL_SERVER_ERROR on a Promise. Zod v4 implements Standard
 * Schema v1 and validates synchronously for a plain string+regex, so it satisfies both
 * without hand-implementing a protocol.
 */
export const usernameSchema = z.string().regex(USERNAME_PATTERN, USERNAME_RULE);
