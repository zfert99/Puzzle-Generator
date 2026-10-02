'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '../auth-client';

type Mode = 'signin' | 'signup';

/**
 * The sign-in / sign-up panel. Passkeys-first per AGENTS.md §6: the passkey button is the
 * primary returning-login, with Google and email/password as account bootstraps.
 *
 * On success it navigates to `callbackURL` — an in-app, root-relative path (Next's
 * `basePath` is added where needed; see `handleGoogle`). Errors from the better-auth
 * client are surfaced inline rather than thrown, so the form stays usable.
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
    // Redirects the browser to Google on success, so `busy` is only ever reset on failure —
    // without this every button stayed disabled after a declined/failed social sign-in.
    try {
    // Redirects the browser to Google; no local navigation needed on success.
    // better-auth resolves a social `callbackURL` against the auth origin, NOT Next's
    // router — so unlike `router.push()` in `done()`, it does NOT prepend Next's
    // `basePath`. Under `basePath: '/puzzles'` a bare "/daily" would send the user to
    // biscuitlab.net/daily (no /puzzles → 404 — the reported bug). Prefix the basePath
    // explicitly here; the email/passkey flows keep the raw value because router.push
    // adds it for them. (Guarded so an already-prefixed callbackURL isn't doubled.)
    const basePath = '/puzzles';
    const hasBasePath = callbackURL === basePath || callbackURL.startsWith(`${basePath}/`);
    const socialCallbackURL = hasBasePath ? callbackURL : `${basePath}${callbackURL}`;
      const res = await signIn.social({ provider: 'google', callbackURL: socialCallbackURL });
      if (res?.error) {
        setError(res.error.message || 'Google sign-in failed');
        setBusy(false);
      }
    } catch {
      setError('Google sign-in failed');
      setBusy(false);
    }
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
        <span className="h-px flex-1 bg-ink-soft/40" /> or email{' '}
        <span className="h-px flex-1 bg-ink-soft/40" />
      </div>

      {/* Real labels (visually hidden), not placeholders alone: a placeholder vanishes as soon as
          the field has a value and is not a label to assistive tech (WCAG 1.3.1 / 3.3.2). The
          autocomplete tokens (1.3.5) let password managers fill the right field, and
          `username webauthn` on the email field enables passkey conditional UI — the browser can
          offer a stored passkey from the autofill dropdown. */}
      <form onSubmit={handleEmail} className="space-y-3" aria-describedby={error ? 'auth-error' : undefined}>
        {mode === 'signup' && (
          <div>
            <label htmlFor="auth-name" className="sr-only">Display name</label>
            <input
              id="auth-name"
              type="text"
              autoComplete="nickname"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-paper border border-ink-soft focus:outline-none focus:ring-2 focus:ring-grape"
            />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="sr-only">Email</label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="username webauthn"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-paper border border-ink-soft focus:outline-none focus:ring-2 focus:ring-grape"
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="sr-only">
            {mode === 'signin' ? 'Password' : 'Password (8+ characters)'}
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-paper border border-ink-soft focus:outline-none focus:ring-2 focus:ring-grape"
          />
        </div>
        {error && <p id="auth-error" role="alert" className="text-cherry text-sm text-center">{error}</p>}
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
          className="text-grape underline"
        >
          {mode === 'signin' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
