// Registers the @testing-library/jest-dom custom matchers (toBeInTheDocument,
// toBeDisabled, etc.) with Vitest's expect. Harmless in the node environment —
// it only extends the matcher registry; the DOM matchers are exercised by the
// jsdom-environment component tests.
import '@testing-library/jest-dom/vitest';
