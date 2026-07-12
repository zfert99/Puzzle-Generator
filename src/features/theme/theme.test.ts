// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getAppliedTheme, setTheme, THEME_STORAGE_KEY } from './theme';

describe('theme helper', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  it('setTheme applies data-theme and persists the choice', () => {
    setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('getAppliedTheme reads the applied attribute, defaulting to light', () => {
    expect(getAppliedTheme()).toBe('light'); // no attribute → light
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(getAppliedTheme()).toBe('dark');
  });
});
