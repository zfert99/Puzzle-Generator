# Username Prompt (`UsernamePrompt.tsx`)

A banner that prompts a signed-in user to pick a public leaderboard handle the first time.

## Why

**Why:** The leaderboard should show a chosen handle, not a user's full account name (which
for Google sign-in is their real name). This prompts for a username right after sign-in and
renders **nothing** once one is set (or when signed out). Later edits live in `AccountBadge`.

```text
if signed out OR username already set -> render nothing
else -> banner with an input; on save:
  validate 3–20 chars [a-zA-Z0-9_-];
  authClient.updateUser({ username });
  on DB unique conflict -> "That username is taken"; else refresh the session
```

Uniqueness is enforced by the DB constraint on `user.username`; better-auth surfaces the
conflict as an error.
