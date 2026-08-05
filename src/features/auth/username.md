# Username Rule (`username.ts`)

The public-handle rule, in one place: a regex and the sentence describing it.

## Why this file exists at all

**Why:** The rule was previously a `USERNAME_RE` literal copy-pasted into two `'use client'`
components — and existed **nowhere on the server**. Two copies of a rule is a maintenance
smell; two copies of a rule that is *only* client-side is a hole, because the client is not
where a rule is enforced. See [auth.md](./auth.md) → "`username` additional field" for what
that let through.

## Why it imports nothing

**Why:** This module is read from both sides of the server/client boundary — `auth.ts` (server)
and the two components (client). Building the Zod schema here would drag Zod into the client
bundle for components that need nothing but a regex, so the schema lives in its own
server-side module ([username-schema.md](./username-schema.md)) and this file stays plain
constants with zero imports.

```text
USERNAME_PATTERN  -> /^[a-zA-Z0-9_-]{3,20}$/
USERNAME_RULE     -> "3–20 letters, numbers, _ or -"
```

## Why the pattern is this narrow

**Why:** The value renders on the public leaderboard for every visitor, signed in or not. An
allowlist of `[a-zA-Z0-9_-]` excludes whitespace, combining marks, and bidi-control characters
(U+202E and friends, which reverse the text around them) *structurally* — rather than trying to
detect and strip them after the fact, which is the losing side of that game. The 20-char cap
keeps a handle from breaking the leaderboard's layout.

Sharing `USERNAME_RULE` (rather than re-typing the sentence) means the client-side hint and the
server's 400 message cannot drift into contradicting each other.

## What it deliberately does not do

Uniqueness is **not** checked here — it is a DB constraint on `user.username`, surfaced by
better-auth as an error the components map to "That username is taken". Case-folding is also
absent, so `Alice` and `alice` are distinct handles; that is pre-existing behavior, not a
decision made here.
