import { describe, expect, it } from 'vitest';
import { consumeFixedWindow, type RateLimitRule } from './rate-limit';

/**
 * Tests target the pure `consumeFixedWindow` core (no Redis, no clock, no env) — the algorithm the
 * production `rateLimit` wrapper delegates to on the in-memory path. The wrapper itself is a no-op
 * under `NODE_ENV === 'test'` by design (so route suites aren't throttled), so its branching isn't
 * unit-tested here; the counting logic that matters lives entirely in the core.
 */
const RULE: RateLimitRule = { max: 3, windowSec: 60 };

describe('consumeFixedWindow', () => {
  it('allows requests up to max, then blocks', () => {
    const store = new Map();
    expect(consumeFixedWindow(store, 'ip', 0, RULE).allowed).toBe(true); // 1
    expect(consumeFixedWindow(store, 'ip', 0, RULE).allowed).toBe(true); // 2
    expect(consumeFixedWindow(store, 'ip', 0, RULE).allowed).toBe(true); // 3
    const blocked = consumeFixedWindow(store, 'ip', 0, RULE); // 4 — over budget
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const store = new Map();
    for (let i = 0; i < 3; i++) consumeFixedWindow(store, 'ip', 0, RULE);
    expect(consumeFixedWindow(store, 'ip', 0, RULE).allowed).toBe(false);
    // A request past the window start (resetAt) begins a fresh window.
    expect(consumeFixedWindow(store, 'ip', 60_000, RULE).allowed).toBe(true);
  });

  it('keys are independent (one IP hitting the limit does not block another)', () => {
    const store = new Map();
    for (let i = 0; i < 4; i++) consumeFixedWindow(store, 'a', 0, RULE);
    expect(consumeFixedWindow(store, 'a', 0, RULE).allowed).toBe(false);
    expect(consumeFixedWindow(store, 'b', 0, RULE).allowed).toBe(true);
  });

  it('retryAfter is in seconds and at least 1', () => {
    const store = new Map();
    for (let i = 0; i < 3; i++) consumeFixedWindow(store, 'ip', 0, RULE);
    // 500 ms into the window: 59.5 s remain → ceil to 60.
    const r = consumeFixedWindow(store, 'ip', 500, RULE);
    expect(r.retryAfter).toBe(60);
  });
});
