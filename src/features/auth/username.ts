/**
 * The public-handle rule, in ONE place — deliberately dependency-free.
 *
 * This module is imported by both the server (`auth.ts`, which wraps the pattern in a Zod
 * schema for better-auth's field validator) and by `'use client'` components. It therefore
 * holds only plain constants and imports nothing: building the Zod schema *here* would drag
 * Zod into the client bundle for two components that need nothing but the regex.
 *
 * The rule was previously duplicated as a `USERNAME_RE` literal in `UsernamePrompt.tsx` and
 * `AccountBadge.tsx` and existed **nowhere on the server** — see `auth.md` → "`username`
 * additional field" for why that was a real hole, not just duplication.
 */

/**
 * 3–20 characters, letters/numbers/underscore/hyphen. Deliberately narrow: the value renders
 * on the public leaderboard for every visitor, so it excludes whitespace, combining marks, and
 * bidi-control characters outright rather than trying to sanitize them after the fact.
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;

/**
 * The single human-readable phrasing of the rule. Shared so the client-side hint and the
 * server's 400 message can never drift into contradicting each other.
 */
export const USERNAME_RULE = '3–20 letters, numbers, _ or -';
