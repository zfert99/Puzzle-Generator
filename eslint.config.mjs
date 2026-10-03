import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // jsx-a11y at `strict` (a11y audit G8): eslint-config-next bundles only a recommended subset.
  // Strict adds the rules that catch what the axe e2e cannot see before a page exists — label
  // associations, interactive roles, key events paired with click handlers, autofocus misuse.
  // Rules only: eslint-config-next already registers the plugin, and a flat config cannot
  // register it twice.
  { files: ["src/**/*.{ts,tsx}"], rules: jsxA11y.flatConfigs.strict.rules },
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
