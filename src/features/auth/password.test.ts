import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password (Argon2id)', () => {
  it('produces an Argon2id-encoded hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    // Encoded Argon2 hashes are self-describing; ours must be the id variant (AGENTS.md §6).
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret-passphrase');
    await expect(verifyPassword({ hash, password: 's3cret-passphrase' })).resolves.toBe(true);
    await expect(verifyPassword({ hash, password: 'not-it' })).resolves.toBe(false);
  });

  it('salts: the same password hashes differently each time', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });
});
