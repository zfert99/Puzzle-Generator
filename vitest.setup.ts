// Registers the @testing-library/jest-dom custom matchers (toBeInTheDocument,
// toBeDisabled, etc.) with Vitest's expect. Harmless in the node environment —
// it only extends the matcher registry; the DOM matchers are exercised by the
// jsdom-environment component tests.
import '@testing-library/jest-dom/vitest';

// jsdom (as of the pinned version) does not implement HTMLDialogElement's showModal/close, which
// the RulesDialog uses — without this, ANY jsdom test rendering GameHeader throws
// "dialog.showModal is not a function". Minimal polyfill: toggle the `open` attribute and fire
// the `close` event (the part the component's onClose relies on). No focus trapping — assertions
// about trap behaviour belong in a real browser, not jsdom.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
