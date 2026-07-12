'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '../auth-client';

type Mode = 'signin' | 'signup';

/**
 * The sign-in / sign-up panel. Passkeys-first per AGENTS.md §6: the passkey button is the
 * primary returning-login, with Google and email/password as account bootstraps.
 *
 * On success it navigates to `callbackURL` (Google redirects itself). Errors from the
 * better-auth client are surfaced inline rather than thrown, so the form stays usable.
 */
export function AuthPanel({ callbackURL = '/daily' }: { callbackURL?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const done = () => {
    router.push(callbackURL);
    router.refresh();
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res =
      mode === 'signup'
        ? await signUp.email({ email, password, name: name || email.split('@')[0] })
        : await signIn.email({ email, password });
    setBusy(false);
    if (res.error) setError(res.error.message || 'Something went wrong');
    else done();
  };

  const handlePasskey = async () => {
    setError('');
    setBusy(true);
    const res = await signIn.passkey();
    setBusy(false);
    if (res?.error) setError(res.error.message || 'Passkey sign-in failed');
    else done();
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    // Redirects the browser to Google; no local navigation needed on success.
    await signIn.social({ provider: 'google', callbackURL });
  };

  return (
    <div className="glass-panel p-8 max-w-md w-full mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </h2>

      <button
        type="button"
        onClick={handlePasskey}
        disabled={busy}
        className="btn-primary w-full mb-3"
      >
        🔑 Sign in with a passkey
      </button>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="w-full mb-5 px-4 py-3 rounded-lg border border-ink hover:bg-paper-2 transition-colors"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-5 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-gray-300 dark:bg-paper" /> or email{' '}
        <span className="h-px flex-1 bg-gray-300 dark:bg-paper" />
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-paper border border-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-paper border border-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-paper border border-ink-soft focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {error && <p className="text-cherry text-sm text-center">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-ink-soft text-center mt-5">
        {mode === 'signin' ? "No account? " : 'Have an account? '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
          }}
          className="text-grape hover:underline"
        >
          {mode === 'signin' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
