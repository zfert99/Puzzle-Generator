'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getAppliedTheme, setTheme, type Theme } from '@/features/theme/theme';
import { setSetting } from './settings';
import { useSetting } from './useSettings';

const THEME_EVENT = 'themechange';

/** Current theme, read from the DOM (set pre-paint) — no setState-in-effect. */
function useAppliedTheme(): Theme | null {
  return useSyncExternalStore<Theme | null>(
    (cb) => {
      window.addEventListener(THEME_EVENT, cb);
      return () => window.removeEventListener(THEME_EVENT, cb);
    },
    () => getAppliedTheme(),
    () => null,
  );
}

/**
 * The app-wide Settings control: a gear button in the header that opens an accessible dialog
 * with theme + accessibility toggles. Reachable from every page (rendered in `AppHeader`).
 *
 * The dialog follows the a11y modal pattern from `Docs/research/accessibility-responsive-qa.md`
 * — `role="dialog"` + `aria-modal`, focus moved in on open and RETURNED to the gear on close,
 * `Esc` to close, and a click-outside scrim — because a settings panel is exactly the kind of
 * surface where we should practice what the accessibility work preaches.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const motion = useSetting('motion');
  const colorblind = useSetting('colorblind');
  const errorHighlight = useSetting('errorHighlight');
  // Theme lives in its own module; read/write it directly so the panel is its single control.
  const theme = useAppliedTheme();

  // Focus into the panel on open; restore focus to the gear on close.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('button, [href], input, select');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        gearRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    gearRef.current?.focus();
  };

  const applyTheme = (t: Theme) => {
    setTheme(t);
    window.dispatchEvent(new Event(THEME_EVENT)); // updates useAppliedTheme + any subscribers
  };

  return (
    <div className="relative">
      <button
        ref={gearRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        className="w-9 h-9 rounded-md flex items-center justify-center text-base border border-paper/40 hover:bg-paper/15 transition-colors"
      >
        ⚙️
      </button>

      {open && (
        <>
          {/* Scrim — click-outside closes. */}
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1rem)] rounded-xl border-[3px] border-ink bg-paper text-ink shadow-chunky p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Settings</h2>
              <button type="button" onClick={close} aria-label="Close settings" className="text-ink-soft hover:text-ink text-lg leading-none">
                ✕
              </button>
            </div>

            {/* Theme */}
            <Segment label="Theme">
              <Choice active={theme === 'light'} onClick={() => applyTheme('light')}>🌞 Light</Choice>
              <Choice active={theme === 'dark'} onClick={() => applyTheme('dark')}>🌙 Dark</Choice>
            </Segment>

            {/* Motion */}
            <Segment label="Motion" hint="Animations like the cell shake and background drift.">
              <Choice active={motion === 'system'} onClick={() => setSetting('motion', 'system')}>Auto</Choice>
              <Choice active={motion === 'full'} onClick={() => setSetting('motion', 'full')}>Full</Choice>
              <Choice active={motion === 'reduce'} onClick={() => setSetting('motion', 'reduce')}>Reduced</Choice>
            </Segment>

            {/* Colorblind */}
            <Toggle
              label="Colorblind mode"
              hint="Shape cues + a colorblind-safe board palette."
              checked={colorblind}
              onChange={(v) => setSetting('colorblind', v)}
            />

            {/* Error highlighting */}
            <Toggle
              label="Highlight mistakes"
              hint="Mark wrong entries while you play."
              checked={errorHighlight}
              onChange={(v) => setSetting('errorHighlight', v)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Segment({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium mb-1">{label}</div>
      {hint && <p className="text-xs text-ink-soft mb-2">{hint}</p>}
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1.5 rounded-lg text-sm border-2 border-ink transition-colors ${
        active ? 'bg-butterscotch text-ink' : 'bg-paper hover:bg-paper-2'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer">
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-11 h-6 rounded-full border-2 border-ink transition-colors relative ${
          checked ? 'bg-butterscotch' : 'bg-paper'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-ink transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}
