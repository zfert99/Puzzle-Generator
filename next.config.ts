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
  serverExternalPackages: ['pdfkit'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
