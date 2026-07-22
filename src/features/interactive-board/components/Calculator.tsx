'use client';

import { useEffect, useRef, useState } from 'react';

type Op = '+' | '−' | '×' | '÷';

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return a / b;
  }
}

const KEY_CLASS =
  'py-3 rounded-lg bg-paper border-2 border-ink hover:bg-paper-2 text-lg font-semibold transition-colors';
const OP_CLASS =
  'py-3 rounded-lg bg-butterscotch/40 border-2 border-ink hover:bg-butterscotch/60 text-lg font-semibold transition-colors';

/**
 * A small floating four-function calculator — a trigger button plus a popup, entirely local
 * state (no board-store involvement). Killer's cage sums are arithmetic the player has to do
 * in their head; this just gives them somewhere to check the addition/subtraction without
 * leaving the puzzle. Reuses the app's standard dialog shell (backdrop, `role="dialog"`,
 * Escape-to-close, click-outside-to-close, focus-on-open) — see `ConfirmModal.tsx`.
 */
export function Calculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op | null>(null);
  const [freshEntry, setFreshEntry] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const inputDigit = (d: string) => {
    setDisplay((prev) => (freshEntry || prev === '0' ? d : prev + d));
    setFreshEntry(false);
  };

  const inputDecimal = () => {
    setDisplay((prev) => (freshEntry ? '0.' : prev.includes('.') ? prev : `${prev}.`));
    setFreshEntry(false);
  };

  const clearAll = () => {
    setDisplay('0');
    setStored(null);
    setPendingOp(null);
    setFreshEntry(true);
  };

  const backspace = () => {
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  /** Commits any pending operation against the current display, then queues the next one. */
  const chooseOp = (op: Op) => {
    const current = Number.parseFloat(display);
    if (pendingOp && !freshEntry && stored !== null) {
      const result = compute(stored, current, pendingOp);
      setDisplay(String(result));
      setStored(result);
    } else {
      setStored(current);
    }
    setPendingOp(op);
    setFreshEntry(true);
  };

  const equals = () => {
    if (pendingOp === null || stored === null) return;
    const current = Number.parseFloat(display);
    const result = compute(stored, current, pendingOp);
    setDisplay(Number.isFinite(result) ? String(result) : 'Error');
    setStored(null);
    setPendingOp(null);
    setFreshEntry(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="py-2 rounded-lg bg-paper border-2 border-ink hover:bg-paper-2 text-sm transition-colors"
      >
        🧮
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Calculator"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-2xl border-[3px] border-ink bg-paper-2 p-4 w-full max-w-[280px] shadow-chunky"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Calculator</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close calculator"
                className="text-ink-soft hover:text-ink text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div
              role="status"
              className="mb-3 px-3 py-2 rounded-lg bg-paper border-2 border-ink text-right font-mono text-2xl overflow-x-auto"
            >
              {display}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={clearAll} className={KEY_CLASS}>
                C
              </button>
              <button type="button" onClick={backspace} aria-label="Backspace" className={KEY_CLASS}>
                ⌫
              </button>
              <button type="button" onClick={() => chooseOp('÷')} className={`${OP_CLASS} col-span-2`}>
                ÷
              </button>

              <button type="button" onClick={() => inputDigit('7')} className={KEY_CLASS}>7</button>
              <button type="button" onClick={() => inputDigit('8')} className={KEY_CLASS}>8</button>
              <button type="button" onClick={() => inputDigit('9')} className={KEY_CLASS}>9</button>
              <button type="button" onClick={() => chooseOp('×')} className={OP_CLASS}>×</button>

              <button type="button" onClick={() => inputDigit('4')} className={KEY_CLASS}>4</button>
              <button type="button" onClick={() => inputDigit('5')} className={KEY_CLASS}>5</button>
              <button type="button" onClick={() => inputDigit('6')} className={KEY_CLASS}>6</button>
              <button type="button" onClick={() => chooseOp('−')} className={OP_CLASS}>−</button>

              <button type="button" onClick={() => inputDigit('1')} className={KEY_CLASS}>1</button>
              <button type="button" onClick={() => inputDigit('2')} className={KEY_CLASS}>2</button>
              <button type="button" onClick={() => inputDigit('3')} className={KEY_CLASS}>3</button>
              <button type="button" onClick={() => chooseOp('+')} className={OP_CLASS}>+</button>

              <button type="button" onClick={() => inputDigit('0')} className={`${KEY_CLASS} col-span-2`}>0</button>
              <button type="button" onClick={inputDecimal} className={KEY_CLASS}>.</button>
              <button type="button" onClick={equals} className={OP_CLASS}>=</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
