'use client';

import { useBoardStore } from '../../store/useBoardStore';

/**
 * On-screen controls for mouse/touch users: a digit pad plus Erase, an
 * `aria-pressed` Pencil toggle, and Undo/Redo. Undo/Redo call into zundo's temporal
 * store directly (its history lives beside the main store, not inside it).
 */
export function Numpad() {
  const size = useBoardStore((s) => s.config.size);
  const pencilMode = useBoardStore((s) => s.pencilMode);
  const inputDigit = useBoardStore((s) => s.inputDigit);
  const clearCell = useBoardStore((s) => s.clearCell);
  const togglePencilMode = useBoardStore((s) => s.togglePencilMode);

  const undo = () => useBoardStore.temporal.getState().undo();
  const redo = () => useBoardStore.temporal.getState().redo();

  return (
    <div className="mt-6 w-full max-w-[520px] mx-auto flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: size }, (_, i) => i + 1).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => inputDigit(digit)}
            className="py-3 rounded-lg bg-white/10 hover:bg-white/20 text-lg font-semibold transition-colors"
          >
            {digit}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button type="button" onClick={() => clearCell()} className="py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
          Erase
        </button>
        <button
          type="button"
          aria-pressed={pencilMode}
          onClick={() => togglePencilMode()}
          className={`py-2 rounded-lg text-sm transition-colors ${
            pencilMode ? 'bg-indigo-600 text-white' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          ✏️ Pencil
        </button>
        <button type="button" onClick={undo} className="py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
          Undo
        </button>
        <button type="button" onClick={redo} className="py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
          Redo
        </button>
      </div>
    </div>
  );
}
