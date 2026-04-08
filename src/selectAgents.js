import { TASK_MAP, FALLBACK_AGENTS } from "./taskMap.js";

/**
 * selectAgents
 *
 * Accepts an intent object from the upstream intent router.
 * Returns a structured agent_selection_output for Layer-2 (Sūtradhāra).
 *
 * @param {{ actor: string, action: string, context: { task: string } }} intent
 * @returns {{ actor, action, agents, sequence, context, selection_metadata }}
 */
export function selectAgents(intent) {
  const { actor, action, context = {} } = intent;

  const mapped = TASK_MAP[context.task];
  const fallback_used = mapped === undefined;
  const agents = fallback_used ? [...FALLBACK_AGENTS] : [...mapped];

  return {
    actor,
    action,
    agents,
    sequence: [...agents],
    context,
    selection_metadata: {
      source: "taskMap",
      confidence: "deterministic",
      fallback_used,
    },
  };
}
