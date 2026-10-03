'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { Modal } from '@/features/chrome/Modal';
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
 * The panel is the shared native `Modal` (`features/chrome/Modal.tsx`): a real focus trap and an
 * inert page behind it, focus moved onto the first control on open and returned to the gear on
 * close, Escape and a backdrop click to dismiss — because a settings panel is exactly the kind of
 * surface where we should practice what the accessibility work preaches. It used to be a
 * hand-rolled `aria-modal` div, which could not stop Tab leaving it (October 2026).
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);

  const motion = useSetting('motion');
  const colorblind = useSetting('colorblind');
  const errorHighlight = useSetting('errorHighlight');
  // Theme lives in its own module; read/write it directly so the panel is its single control.
  const theme = useAppliedTheme();

  const close = () => setOpen(false); // the shell hands focus back to the gear

  const applyTheme = (t: Theme) => {
    setTheme(t);
    window.dispatchEvent(new Event(THEME_EVENT)); // updates useAppliedTheme + any subscribers
  };

  return (
    <>
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

      {/* Viewport-centered by the shell (never anchored to the gear: that ran off the left edge
          of a phone, where the gear sits mid-header). */}
      <Modal
        open={open}
        onDismiss={close}
        ariaLabel="Settings"
        className="w-72 max-w-[calc(100%-2rem)]"
        cardClassName="rounded-xl border-[3px] border-ink bg-paper text-ink shadow-chunky p-4 space-y-4 text-left"
      >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Settings</h2>
              <button type="button" onClick={close} aria-label="Close settings" className="tap-target text-ink-soft hover:text-ink text-lg leading-none min-w-6 min-h-6">
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
      </Modal>
    </>
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
      className={`tap-target px-2.5 py-1.5 rounded-lg text-sm border-2 border-ink transition-colors ${
        active ? 'bg-butterscotch text-on-butterscotch' : 'bg-paper hover:bg-paper-2'
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
