'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut, passkey, updateUser, type SessionUser } from '../auth-client';

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

/**
 * A small session-aware header control: shows the signed-in user's handle with actions to
 * change the username, add a passkey, and sign out — or a "Sign in" link when signed out.
 * Uses better-auth's reactive `useSession`, so it updates without a page reload.
 *
 * "Add passkey" lives here (post-sign-in) because a passkey must be registered against an
 * existing account. Username editing is inline so a handle can be changed any time.
 */
export function AccountBadge() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  if (isPending) {
    return <span className="text-xs text-ink-soft" aria-hidden="true">…</span>;
  }

  if (!session) {
    return (
      <Link href="/signin" className="text-sm text-paper font-semibold hover:underline">
        Sign in
      </Link>
    );
  }

  const user = session.user as SessionUser;
  const display = user.username || user.name || user.email;

  const addPasskey = async () => {
    setNote('');
    const res = await passkey.addPasskey({ name: 'This device' });
    setNote(res?.error ? 'Passkey setup failed' : 'Passkey added ✓');
  };

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
  };

  const saveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!USERNAME_RE.test(value)) {
      setError('3–20 letters, numbers, _ or -');
      return;
    }
    setError('');
    const res = await updateUser({ username: value });
    if (res.error) {
      setError(res.error.message?.includes('unique') ? 'Taken' : 'Failed');
    } else {
      setEditing(false);
      router.refresh();
    }
  };

  if (editing) {
    return (
      <form onSubmit={saveUsername} className="flex items-center gap-2 text-sm">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="username"
          className="px-2 py-1 rounded-md bg-paper text-ink border border-ink text-sm w-32 focus:outline-none focus:ring-2 focus:ring-butterscotch"
        />
        <button type="submit" className="text-paper font-semibold hover:underline">Save</button>
        <button type="button" onClick={() => { setEditing(false); setError(''); }} className="text-paper/70 hover:underline">
          Cancel
        </button>
        {error && <span className="text-xs text-paper font-semibold">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-paper font-semibold">{display}</span>
      <button
        type="button"
        onClick={() => { setValue(user.username || ''); setEditing(true); }}
        className="text-paper/90 hover:underline hidden sm:inline"
      >
        {user.username ? 'Change username' : 'Set username'}
      </button>
      <button type="button" onClick={addPasskey} className="text-paper/90 hover:underline hidden sm:inline">
        Add passkey
      </button>
      <button type="button" onClick={handleSignOut} className="text-paper/70 hover:underline">
        Sign out
      </button>
      {note && <span className="text-xs text-paper/70">{note}</span>}
    </div>
  );
}
