// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasskeyManager } from './PasskeyManager';

/**
 * The better-auth client is the boundary here (AGENTS.md Section 4): `addPasskey` runs a
 * real WebAuthn ceremony (`navigator.credentials`) that jsdom cannot perform, so we mock
 * the auth-client and assert the component's OWN behaviour — gating on session, rendering
 * the list, calling add/remove, and surfacing errors — not the WebAuthn round-trip itself.
 */
const h = vi.hoisted(() => ({
  addPasskey: vi.fn(),
  deletePasskey: vi.fn(),
  session: { data: { user: { id: 'u1', email: 'z@example.com' } }, isPending: false } as {
    data: unknown;
    isPending: boolean;
  },
  list: { data: [] as Array<{ id: string; name?: string; createdAt: string }>, isPending: false, error: null as unknown },
}));

vi.mock('../auth-client', () => ({
  authClient: { useListPasskeys: () => h.list },
  useSession: () => h.session,
  passkey: { addPasskey: h.addPasskey, deletePasskey: h.deletePasskey },
}));

afterEach(() => {
  vi.clearAllMocks();
  h.session = { data: { user: { id: 'u1', email: 'z@example.com' } }, isPending: false };
  h.list = { data: [], isPending: false, error: null };
});

describe('PasskeyManager', () => {
  it('prompts to sign in when there is no session', () => {
    h.session = { data: null, isPending: false };
    render(<PasskeyManager />);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin');
  });

  it('shows an empty state when the user has no passkeys', () => {
    render(<PasskeyManager />);
    expect(screen.getByText(/no passkeys yet/i)).toBeInTheDocument();
  });

  it('lists registered passkeys with a remove control', () => {
    h.list = {
      data: [{ id: 'pk1', name: 'MacBook', createdAt: '2026-07-01' }],
      isPending: false,
      error: null,
    };
    render(<PasskeyManager />);
    expect(screen.getByText('MacBook')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('registers a passkey with the typed name', async () => {
    h.addPasskey.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<PasskeyManager />);

    await user.type(screen.getByLabelText(/passkey name/i), 'Phone');
    await user.click(screen.getByRole('button', { name: /add a passkey/i }));

    expect(h.addPasskey).toHaveBeenCalledWith({ name: 'Phone' });
  });

  it('surfaces an add error', async () => {
    h.addPasskey.mockResolvedValue({ data: null, error: { message: 'Registration failed' } });
    const user = userEvent.setup();
    render(<PasskeyManager />);

    await user.click(screen.getByRole('button', { name: /add a passkey/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/registration failed/i);
  });

  it('removes a passkey by id', async () => {
    h.list = {
      data: [{ id: 'pk1', name: 'MacBook', createdAt: '2026-07-01' }],
      isPending: false,
      error: null,
    };
    h.deletePasskey.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<PasskeyManager />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(h.deletePasskey).toHaveBeenCalledWith({ id: 'pk1' });
  });
});
