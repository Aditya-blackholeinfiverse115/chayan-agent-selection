/**
 * NOTE: The registry, validateStructure, and buildActionProposal below are
 * intentional inline copies for demo/replay purposes only.
 * They mirror agent-sandbox exactly. When cross-repo imports are available,
 * replace with direct imports from Sūtradhāra.
 */

import { selectAgents } from "./selectAgents.js";

// ─── Inline registry (mirrors agent-sandbox AgentRegistry) ───────────────────

const REGISTRY = [
  { id: 1, name: "Text Summarizer",     lifecycle_state: "Active" },
  { id: 2, name: "Data Formatter",      lifecycle_state: "Active" },
  { id: 3, name: "Risk Evaluator",      lifecycle_state: "Active" },
  { id: 4, name: "Document Classifier", lifecycle_state: "Suspended" },
  { id: 5, name: "Language Translator", lifecycle_state: "Active" },
  { id: 6, name: "Workflow Router",     lifecycle_state: "Active" },
];

function getAgentById(id) {
  const normalized = typeof id === "string" ? Number(id) : id;
  return REGISTRY.find((a) => a.id === normalized) ?? null;
}

// ─── Inline StructuralValidator ───────────────────────────────────────────────

const FORBIDDEN_CHAINS = [[3, 1], [6, 2]];

function validateStructure(resolvedAgents = []) {
  const errors = [];

  for (const agent of resolvedAgents) {
    if (agent.lifecycle_state === "Suspended") {
      errors.push({ code: "AGENT_SUSPENDED", message: `Suspended agent detected: ${agent.id}` });
    }
  }

  const ids = resolvedAgents.map((a) => a.id);
  if (new Set(ids).size !== ids.length) {
    errors.push({ code: "DUPLICATE_AGENTS", message: "Duplicate agents detected" });
  }

  for (let i = 0; i < resolvedAgents.length - 1; i++) {
    for (const [from, to] of FORBIDDEN_CHAINS) {
      if (resolvedAgents[i].id === from && resolvedAgents[i + 1].id === to) {
        errors.push({
          code: "INVALID_CHAIN",
          message: `Invalid chaining: ${resolvedAgents[i].name} cannot precede ${resolvedAgents[i + 1].name}`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Inline buildActionProposal ───────────────────────────────────────────────

function buildActionProposal({ actor, action, agents, context = {} }) {
  const resolved = agents.map((id) => getAgentById(id));

  if (resolved.includes(null)) {
    return { actor, action, agents, sequence: [...agents], constraints: { lifecycle_valid: false }, context, governance_request: null };
  }

  const validation = validateStructure(resolved);

  if (!validation.valid) {
    return { actor, action, agents, sequence: [...agents], constraints: { lifecycle_valid: false }, context, governance_request: null };
  }

  return {
    actor, action, agents,
    sequence: [...agents],
    constraints: { lifecycle_valid: true },
    context,
    governance_request: { actor, action, resource: agents, context },
  };
}

// ─── runPipeline ──────────────────────────────────────────────────────────────

/**
 * Runs the full pipeline for a single intent.
 * Returns a structured log: { intent, selection, proposal }
 *
 * @param {{ actor: string, action: string, context: { task: string } }} intent
 * @returns {{ intent: object, selection: object, proposal: object }}
 */
export function runPipeline(intent) {
  const selection = selectAgents(intent);
  const proposal  = buildActionProposal(selection);
  return { intent, selection, proposal };
}
