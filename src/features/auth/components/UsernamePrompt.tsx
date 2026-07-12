'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, updateUser, type SessionUser } from '../auth-client';

/** 3–20 chars, letters/numbers/underscore/hyphen — a safe public handle. */
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

/**
 * Prompts a signed-in user to pick a public username the first time (so the leaderboard
 * shows a handle, not their full account name). Renders nothing once a username is set, or
 * when signed out. Editing later lives in `AccountBadge`.
 */
export function UsernamePrompt() {
  const { data: session } = useSession();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const username = (session?.user as SessionUser | undefined)?.username;
  if (!session || username) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!USERNAME_RE.test(value)) {
      setError('3–20 letters, numbers, _ or -');
      return;
    }
    setError('');
    setBusy(true);
    const res = await updateUser({ username: value });
    setBusy(false);
    if (res.error) setError(res.error.message?.includes('unique') ? 'That username is taken' : res.error.message || 'Could not save');
    else router.refresh();
  };

  return (
    <div className="glass-panel p-4 max-w-md w-full mx-auto mb-4 border border-indigo-500/30">
      <p className="text-sm font-medium mb-2 text-center">Pick a username for the leaderboard</p>
      <form onSubmit={save} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. sudoku_ace"
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" disabled={busy} className="btn-primary px-4">
          {busy ? '…' : 'Save'}
        </button>
      </form>
      {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
    </div>
  );
}
