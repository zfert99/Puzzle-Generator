import type { NextConfig } from "next";

// Baseline security headers (OWASP Top 10:2025 A02 — Security Misconfiguration). No CSP
// yet: a nonce-based CSP needs the inline pre-paint <script> tags in app/layout.tsx to
// carry a matching nonce, which is a separate, larger piece of work — see next.config.md.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Served under /puzzles via the hub's multi-zone rewrite (Phase 3). basePath
  // scopes routes AND /_next/* assets in Next 15+ — no assetPrefix needed. It is
  // build-time inlined, so a change requires a redeploy. See
  // Docs/multi-zone-migration-plan.md.
  basePath: '/puzzles',
  serverExternalPackages: ['pdfkit'],
  // Cross-zone Server Actions (better-auth / form posts) must trust the public
  // origin, since the request arrives through the hub's proxy. Still nested under
  // `experimental` in this Next version (per the serverActions config docs).
  experimental: { serverActions: { allowedOrigins: ['biscuitlab.net'] } },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Lets a phone on the same Wi-Fi hit `next dev -H 0.0.0.0` directly (HMR + /_next/*
  // assets) for real-device mobile testing without deploying — Next 16 blocks cross-origin
  // dev requests by default (PR #91507). Dev-only allowlist; irrelevant to production.
  allowedDevOrigins: ['192.168.1.239'],
};

export default nextConfig;
