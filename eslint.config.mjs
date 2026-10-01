import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code session worktrees live inside the repo (`.claude/worktrees/<name>/`), each
    // with its own `.next/` build output. The root `.next/**` pattern doesn't reach them, so a
    // lint run from the main checkout drowned in ~400 errors from a sibling session's chunks.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
