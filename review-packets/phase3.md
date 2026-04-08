# Review Packet — Phase 3
## Chayan (chayan-agent-selection)

---

## 1. Entry Point

**File:** `src/pipeline.js`
**Function:** `runPipeline(intent, { _timestamp })`

Wires `selectAgents` → `buildActionProposal`. Returns `{ intent, selection, proposal }`. The `_timestamp` option is an injection point for replay tests — production callers omit it.

---

## 2. Three Core Files

### `src/taskMap.js`

Static mapping of task identifiers to ordered agent ID arrays. Data only — no logic.

```js
export const TASK_MAP = {
  "summarize-and-format":    ["1", "2"],
  "evaluate-and-route":      ["3", "6"],
  "translate-and-summarize": ["5", "1"],
  "classify-and-format":     ["4", "2"],
};

export const FALLBACK_AGENTS = [];
```

`FALLBACK_AGENTS` is the explicit fallback strategy. Empty by default — Sūtradhāra will produce an `EMPTY_CHAIN` failure. Replace with a real agent ID when a fallback handler is available.

### `src/selectAgents.js`

Maps `context.task` to agents via `TASK_MAP`. Returns `agent_selection_output` including `selection_metadata` — `source`, `confidence`, and `fallback_used` flag.

### `src/pipeline_replay.test.js`

9 replay tests running 20 iterations each. Proves `proposal_id`, `failure`, `governance_request`, `selection_metadata`, `contract_version`, and `timestamp` are all identical across runs. Also proves different inputs produce different `proposal_id`.

---

## 3. Full Pipeline Flow

```
Intent
  { actor, action, context: { task } }
        │
        ▼
  selectAgents(intent)
        │  TASK_MAP lookup
        │  fallback_used = task not in map
        ▼
  agent_selection_output
  {
    actor, action, agents, sequence, context,
    selection_metadata: {
      source: "taskMap",
      confidence: "deterministic",
      fallback_used: true/false
    }
  }
        │
        ▼
  buildActionProposal(selection)
        │  empty chain check
        │  registry resolution
        │  structural validation
        ▼
  ActionProposal
  { proposal_id, timestamp, contract_version,
    actor, action, agents, sequence, constraints,
    context, failure, governance_request }
        │
        ▼
  runPipeline log
  { intent, selection, proposal }
```

---

## 4. Sample JSON

### Success — known task

**Intent:**
```json
{
  "actor": "intent-router",
  "action": "task.route",
  "context": { "task": "summarize-and-format" }
}
```

**agent_selection_output:**
```json
{
  "actor": "intent-router",
  "action": "task.route",
  "agents": ["1", "2"],
  "sequence": ["1", "2"],
  "context": { "task": "summarize-and-format" },
  "selection_metadata": {
    "source": "taskMap",
    "confidence": "deterministic",
    "fallback_used": false
  }
}
```

**ActionProposal:**
```json
{
  "proposal_id": "ap-3f2a1b",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "contract_version": "v1.1",
  "actor": "intent-router",
  "action": "task.route",
  "agents": ["1", "2"],
  "sequence": ["1", "2"],
  "constraints": { "lifecycle_valid": true },
  "context": { "task": "summarize-and-format" },
  "failure": null,
  "governance_request": {
    "actor": "intent-router",
    "action": "task.route",
    "resource": ["1", "2"],
    "context": { "task": "summarize-and-format" }
  }
}
```

### Failure — unknown task (fallback used, empty chain)

**Intent:**
```json
{
  "actor": "intent-router",
  "action": "task.route",
  "context": { "task": "unknown.task" }
}
```

**agent_selection_output:**
```json
{
  "actor": "intent-router",
  "action": "task.route",
  "agents": [],
  "sequence": [],
  "context": { "task": "unknown.task" },
  "selection_metadata": {
    "source": "taskMap",
    "confidence": "deterministic",
    "fallback_used": true
  }
}
```

**ActionProposal:**
```json
{
  "proposal_id": "ap-1a2b3c",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "contract_version": "v1.1",
  "actor": "intent-router",
  "action": "task.route",
  "agents": [],
  "sequence": [],
  "constraints": { "lifecycle_valid": false },
  "context": { "task": "unknown.task" },
  "failure": {
    "stage": "EMPTY_CHAIN",
    "codes": ["EMPTY_AGENT_CHAIN"],
    "message": "No agents provided — an empty chain cannot be executed"
  },
  "governance_request": null
}
```

---

## 5. Failure Cases

| Scenario | `fallback_used` | Failure stage | `governance_request` |
|---|---|---|---|
| Known task, valid chain | `false` | none | populated |
| Known task, suspended agent | `false` | `STRUCTURAL_VALIDATION` | `null` |
| Unknown task, no fallback | `true` | `EMPTY_CHAIN` | `null` |

---

## 6. Proof

### Test run

```
chayan-agent-selection
  selectAgents.test.js       8 tests   ✅
  pipeline.test.js           6 tests   ✅
  pipeline_replay.test.js    9 tests   ✅

Total: 23 tests — all pass
```

### Key replay assertions (pipeline_replay.test.js, 20 runs each)

**RPT-01** — `proposal_id` identical:
```js
expect(allEqual(runs, (r) => r.proposal.proposal_id)).toBe(true);
```

**RPT-04** — `selection_metadata` identical:
```js
expect(allEqual(runs, (r) => r.selection.selection_metadata)).toBe(true);
expect(runs[0].selection.selection_metadata).toEqual({
  source: "taskMap",
  confidence: "deterministic",
  fallback_used: false,
});
```

**RPT-06** — empty chain failure identical:
```js
expect(allEqual(runs, (r) => r.proposal.failure)).toBe(true);
expect(runs[0].proposal.failure).toEqual({
  stage: "EMPTY_CHAIN",
  codes: ["EMPTY_AGENT_CHAIN"],
  message: "No agents provided — an empty chain cannot be executed",
});
```

**RPT-07** — different inputs, different `proposal_id`:
```js
expect(a.proposal.proposal_id).not.toBe(b.proposal.proposal_id);
expect(b.proposal.proposal_id).not.toBe(c.proposal.proposal_id);
```

**RPT-09** — timestamp is injected, not live clock:
```js
expect(runs[0].proposal.timestamp).toBe(FIXED_TS);
```
