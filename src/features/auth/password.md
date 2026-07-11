# Password Hashing (`password.ts`)

Argon2id hash/verify for better-auth's email/password path.

## Why override better-auth's default

**Why:** better-auth hashes passwords with **scrypt** by default. AGENTS.md §6 mandates
Argon2id (or bcrypt-with-prehash), so we supply custom `hash`/`verify` functions to
`emailAndPassword.password`. Parameters are the OWASP baseline: **m=19456 KiB, t=2, p=1**.

## Why a standalone module

**Why:** No `server-only`, no DB import — so it is unit-testable in isolation and the exact
cost parameters live in one reviewable place. `@node-rs/argon2` already defaults its
`algorithm` to Argon2id, so we set only the cost parameters (and avoid importing the
`Algorithm` const enum, which Next's `isolatedModules` forbids). The test asserts the hash
carries the `$argon2id$` prefix, proving the variant is correct.

```text
hashPassword(password)            -> Argon2id-encoded hash string (salt embedded)
verifyPassword({ hash, password}) -> boolean   (shape matches better-auth's verify contract)
```

## Note

Passkeys are the primary sign-in; this only guards the email/password fallback. But when a
password IS stored, it must be hashed correctly — that is this module's whole job.
