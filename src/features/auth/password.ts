import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing for better-auth's email/password path.
 *
 * AGENTS.md §6 mandates a memory-hard hash; better-auth's default is scrypt, so we
 * override it with **Argon2id** at the OWASP baseline (m=19456 KiB, t=2, p=1). These
 * are passed to better-auth via `emailAndPassword.password.{hash,verify}`.
 *
 * Kept as a standalone module (no `server-only`, no DB import) so it is unit-testable in
 * isolation and so the exact cost parameters live in one reviewable place. Passkeys are
 * the primary sign-in (this only guards the email/password fallback), but when a password
 * IS stored it must be hashed correctly.
 */
// @node-rs/argon2 defaults `algorithm` to Argon2id already, so we set only the cost
// parameters. (The `Algorithm` enum is a const enum, which Next's isolatedModules
// forbids importing — another reason to rely on the correct default rather than name it.)
const ARGON2ID_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hash a plaintext password with Argon2id. Returns an encoded hash (salt embedded). */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID_OPTIONS);
}

/** Verify a plaintext password against a stored Argon2id hash. */
export function verifyPassword({ hash: stored, password }: { hash: string; password: string }): Promise<boolean> {
  return verify(stored, password);
}
