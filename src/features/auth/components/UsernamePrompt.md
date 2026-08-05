# Username Prompt (`UsernamePrompt.tsx`)

A banner that prompts a signed-in user to pick a public leaderboard handle the first time.

## Why

**Why:** The leaderboard should show a chosen handle, not a user's full account name (which
for Google sign-in is their real name). This prompts for a username right after sign-in and
renders **nothing** once one is set (or when signed out). Later edits live in `AccountBadge`.

```text
if signed out OR username already set -> render nothing
else -> banner with an input; on save:
  local hint check against USERNAME_PATTERN;
  authClient.updateUser({ username });
  on DB unique conflict -> "That username is taken"; else refresh the session
```

Uniqueness is enforced by the DB constraint on `user.username`; better-auth surfaces the
conflict as an error.

## Why the check here is a hint, not the rule

**Why:** The pattern and its message come from [username.ts](../username.md) rather than a
local literal, and the **server** enforces the same rule via better-auth's field validator
(see [auth.md](../auth.md)). This check exists only to give immediate feedback without a round
trip — bypassing this input still gets a 400. Until August 2026 a copy of the regex lived here
and in `AccountBadge.tsx` and *nowhere on the server*, which meant the rule applied to the form
but not to the endpoint.
