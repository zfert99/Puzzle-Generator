import type { Metadata } from 'next';
import { PasskeyManager } from '@/features/auth/components/PasskeyManager';

export const metadata: Metadata = { title: 'Account' };

/**
 * /account — the signed-in account surface. Server Component shell (routing/layout only);
 * the interactive passkey management lives in the client `PasskeyManager` leaf, which gates
 * on the session itself. Nav lives in the global `AppHeader`.
 */
export default function AccountPage() {
  return (
    <main className="flex-1 flex flex-col items-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-extrabold tracking-tight mb-6 text-ink">Account</h1>
        <div className="glass-panel p-6">
          <PasskeyManager />
        </div>
      </div>
    </main>
  );
}
