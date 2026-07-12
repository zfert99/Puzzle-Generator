import { AuthPanel } from '@/features/auth/components/AuthPanel';

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
