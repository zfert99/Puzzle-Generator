'use client';

// The motion switch now lives in app settings (`features/settings`): 'system' follows the OS,
// 'reduce'/'full' override it. This re-export keeps the existing juice consumers
// (template.tsx, SolvedStamp) on one source of truth without churn.
export { useMotionReduced as useReducedMotion } from '@/features/settings/useSettings';
