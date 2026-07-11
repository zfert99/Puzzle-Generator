'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut, passkey } from '../auth-client';

/**
 * A small session-aware header control: shows the signed-in user's name with sign-out and
 * an "add passkey" action, or a "Sign in" link when signed out. Uses better-auth's reactive
 * `useSession`, so it updates without a page reload after sign-in/out.
 *
 * "Add passkey" is offered here (post-sign-in) because a passkey must be registered against
 * an existing account — passkeys-first means passkey is the primary *returning* login, set
 * up once from a signed-in session.
 */
export function AccountBadge() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [note, setNote] = useState('');

  if (isPending) {
    return <span className="text-xs text-gray-400" aria-hidden="true">…</span>;
  }

  if (!session) {
    return (
      <Link href="/signin" className="text-sm text-indigo-400 hover:underline">
        Sign in
      </Link>
    );
  }

  const addPasskey = async () => {
    setNote('');
    const res = await passkey.addPasskey({ name: 'This device' });
    setNote(res?.error ? 'Passkey setup failed' : 'Passkey added ✓');
  };

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{session.user.name || session.user.email}</span>
      <button type="button" onClick={addPasskey} className="text-indigo-400 hover:underline">
        Add passkey
      </button>
      <button type="button" onClick={handleSignOut} className="text-gray-400 hover:underline">
        Sign out
      </button>
      {note && <span className="text-xs text-gray-400">{note}</span>}
    </div>
  );
}
