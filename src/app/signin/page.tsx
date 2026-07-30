import type { Metadata } from 'next';
import { AuthPanel } from '@/features/auth/components/AuthPanel';

// Keep the login page out of the index (crawlable so links are still followed, but
// noindex): Google folds generic login pages together as duplicates, and a thin auth
// page adds no search value. Excluded from the sitemap for the same reason. `noindex`
// (not a robots.txt Disallow) is the correct tool — a disallowed URL can still be
// indexed from external links since Googlebot never fetches it to see the tag. See
// Docs/research/sitemap-architecture-multi-zone.md (Fork 2).
export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: true } };

/**
 * /signin — the authentication route. Server Component shell (routing/layout only); the
 * interactive form lives in the client `AuthPanel` leaf. No session logic here — the
 * client handles sign-in and navigates on success. Nav lives in the global `AppHeader`.
 */
export default function SignInPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-ink">Puzzle Lab</h1>
      </div>

      <AuthPanel />
    </main>
  );
}
