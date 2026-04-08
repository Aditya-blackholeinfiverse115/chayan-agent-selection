/**
 * taskMap.js
 *
 * Deterministic mapping of task identifiers to ordered agent ID sequences.
 * Add new task mappings here — no logic changes required elsewhere.
 */

export const TASK_MAP = {
  "summarize-and-format":    ["1", "2"],
  "evaluate-and-route":      ["3", "6"],
  "translate-and-summarize": ["5", "1"],
  "classify-and-format":     ["4", "2"],
};

// Fallback agent chain for unknown tasks.
// Empty by default — Sūtradhāra will produce an EMPTY_CHAIN failure.
// Replace with a default agent ID when a fallback handler is available.
export const FALLBACK_AGENTS = [];
