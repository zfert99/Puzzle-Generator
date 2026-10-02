// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameClock } from './useGameClock';
import { useBoardStore } from '../store/useBoardStore';
import { generateSudoku } from '@/features/engine/sudoku';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useGameClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
    useBoardStore.getState().startNewGame(generateSudoku('easy', 4));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks once a second while active and the tab is visible', () => {
    renderHook(() => useGameClock(true));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(useBoardStore.getState().elapsedTime).toBe(3);
  });

  it('does not tick while inactive', () => {
    renderHook(() => useGameClock(false));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(useBoardStore.getState().elapsedTime).toBe(0);
  });

  it('freezes while the document is hidden and resumes when it is visible again', () => {
    renderHook(() => useGameClock(true));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useBoardStore.getState().elapsedTime).toBe(2);

    act(() => setVisibility('hidden'));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(useBoardStore.getState().elapsedTime).toBe(2);

    act(() => setVisibility('visible'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(useBoardStore.getState().elapsedTime).toBe(3);
  });

  it('stops the interval on unmount', () => {
    const { unmount } = renderHook(() => useGameClock(true));
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(useBoardStore.getState().elapsedTime).toBe(0);
  });
});
