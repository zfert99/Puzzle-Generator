'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient, useSession, passkey, type SessionUser } from '../auth-client';

/**
 * Signed-in passkey management: list registered passkeys, add a new one, remove one.
 *
 * WebAuthn registration (`passkey.addPasskey`) runs the browser credential ceremony, so
 * this is a client leaf. The list comes from better-auth's `useListPasskeys()` query hook,
 * which auto-refreshes after add/remove via the plugin's `$listPasskeys` atom — no manual
 * refetch needed. This is the account surface the header intentionally does NOT carry
 * (see AccountBadge); it's also what makes the passkeys-first flow actually usable, and
 * the prerequisite for the multi-zone rpID move (register a fresh passkey to verify it).
 */
export function PasskeyManager() {
  const { data: session, isPending: sessionPending } = useSession();
  const { data: passkeys, isPending: listPending, error: listError } =
    authClient.useListPasskeys();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (sessionPending) {
    return <p className="text-ink-soft" aria-hidden="true">…</p>;
  }

  if (!session) {
    return (
      <p className="text-ink-soft">
        <Link href="/signin" className="text-grape hover:underline">
          Sign in
        </Link>{' '}
        to manage your passkeys.
      </p>
    );
  }

  const user = session.user as SessionUser;

  const handleAdd = async () => {
    setError('');
    setBusy(true);
    const res = await passkey.addPasskey({ name: name.trim() || undefined });
    setBusy(false);
    if (res?.error) setError(res.error.message || 'Could not add passkey');
    else setName('');
  };

  const handleRemove = async (id: string) => {
    setError('');
    setBusy(true);
    const res = await passkey.deletePasskey({ id });
    setBusy(false);
    if (res?.error) setError(res.error.message || 'Could not remove passkey');
  };

  return (
    <section aria-labelledby="passkeys-heading">
      <h2 id="passkeys-heading" className="text-xl font-semibold text-ink mb-1">
        Passkeys
      </h2>
      <p className="text-sm text-ink-soft mb-4">
        Passwordless sign-in for <span className="font-semibold">{user.username || user.email}</span>.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <label htmlFor="passkey-name" className="sr-only">
          Passkey name
        </label>
        <input
          id="passkey-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional, e.g. MacBook)"
          className="flex-1 px-3 py-2 rounded-lg bg-paper border border-ink-soft focus:outline-none focus:ring-2 focus:ring-butterscotch"
        />
        <button type="button" onClick={handleAdd} disabled={busy} className="btn-primary">
          🔑 Add a passkey
        </button>
      </div>
      {error && (
        <p role="alert" className="text-cherry text-sm mb-2">
          {error}
        </p>
      )}

      {listPending ? (
        <p className="text-ink-soft text-sm">Loading passkeys…</p>
      ) : listError ? (
        <p className="text-cherry text-sm">Couldn&rsquo;t load your passkeys.</p>
      ) : !passkeys || passkeys.length === 0 ? (
        <p className="text-ink-soft text-sm">No passkeys yet. Add one above.</p>
      ) : (
        <ul className="divide-y divide-ink-soft/30 border-t border-ink-soft/30 mt-2">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center justify-between py-2">
              <span className="text-ink">
                <span className="font-semibold">{pk.name || 'Passkey'}</span>{' '}
                <span className="text-ink-soft text-xs">
                  added {new Date(pk.createdAt).toLocaleDateString()}
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleRemove(pk.id)}
                disabled={busy}
                className="text-cherry text-sm hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
