# Next.js Config (`next.config.ts`)

## `serverExternalPackages: ['pdfkit']`

**Why:** `pdfkit` uses native Node APIs (`fs`, streams) that Turbopack's default bundling
doesn't handle well server-side; this opts it out of bundling so it runs as a plain Node
`require` in the API routes that generate PDFs.

## Baseline security headers (July 2026)

**Why:** Added while auditing the codebase against a new web-security research doc
(`Docs/research/ai-assisted-nextjs-security-reference.md`), whose OWASP Top 10:2025 mapping puts
Security Misconfiguration at #2 (up from #5) — missing security headers is the concrete,
checkable instance of that category for this app. Applied to every route (`/:path*`):

```text
X-Content-Type-Options: nosniff                — stop MIME-sniffing a response into script
X-Frame-Options: DENY                          — this app is never legitimately framed
Referrer-Policy: strict-origin-when-cross-origin — don't leak full URLs to other origins
Permissions-Policy: camera=(), microphone=(), geolocation=() — no feature here needs them
```

**Why no `Strict-Transport-Security` header here:** Vercel adds HSTS automatically at the
edge for all production deployments, so setting it again here would be redundant.

**Why no CSP yet (deliberately deferred, not an oversight):** A real CSP for this app needs
to be nonce-based to allow the two inline pre-paint `<script>` tags in `app/layout.tsx`
(`THEME_PRE_PAINT_SCRIPT`, `SETTINGS_PRE_PAINT_SCRIPT` — read `localStorage` before first
paint to avoid a flash of the wrong theme/motion setting). That requires generating a nonce
per request (middleware or a dynamic root layout) and threading it onto both script tags and
the CSP header, which also forces those routes into fully dynamic rendering. That's real,
separate work with its own testing burden — flagged for a follow-up pass rather than bundled
into this baseline-headers change.

## `allowedDevOrigins` (July 2026)

**Why:** Next.js 16 blocks cross-origin requests to dev-only assets/endpoints by default
(PR #91507, "block disallowed dev origins by default") — a phone on the same Wi-Fi hitting
`next dev -H 0.0.0.0` at the machine's LAN IP would get HMR/`/_next/*` requests 403'd
without an explicit allowlist entry. Added to test real mobile bugs (reported via
screenshots from an actual phone) directly against the dev server — per
`Docs/research/compass_artifact_wf-5a169f5a-3c9f-5799-9a6f-6060e47bd0ca_text_markdown.md`,
this "Tier 1" same-network loop is free, keeps hot-reload, and catches the large majority of
responsive/layout bugs without a deploy; reserve Vercel preview deployments for sharing with
others, not for iterating on responsiveness solo. Dev-only — has no effect in production.
Hardcodes this machine's current LAN IP rather than a wildcard/CIDR, since the guard is a
security boundary and the IP is only needed for the duration of a local testing session; if
the network's DHCP lease changes, update the entry (`ipconfig getifaddr en0` on macOS).
